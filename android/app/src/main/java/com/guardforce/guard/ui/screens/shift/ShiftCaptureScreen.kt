package com.guardforce.guard.ui.screens.shift

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.domain.Duty
import com.guardforce.guard.domain.DutyState
import com.guardforce.guard.domain.Geo
import com.guardforce.guard.media.CameraPreview
import com.guardforce.guard.media.ImageCompressor
import com.guardforce.guard.media.mediaFile
import com.guardforce.guard.media.rememberCameraController
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.Eyebrow
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.time.Duration
import java.time.Instant

private const val GOOD_ACCURACY_M = 50f

/** Selfie → GPS fix → confirm, for both shift start (F4) and end. */
@Composable
fun ShiftCaptureScreen(vm: AppViewModel, end: Boolean, onDone: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val camera = rememberCameraController()
    val duty by vm.duty.collectAsStateWithLifecycle()
    val live by vm.live.collectAsStateWithLifecycle()
    val me by vm.me.collectAsStateWithLifecycle()
    val t = Graph.repo.timeText()

    var selfie by remember { mutableStateOf<File?>(null) }
    var fix by remember { mutableStateOf<Location?>(null) }
    var searching by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val maxKb = me?.config?.selfie_max_kb ?: 120

    val lm = ctx.getSystemService(LocationManager::class.java)
    val locationOn = if (Build.VERSION.SDK_INT >= 28) lm.isLocationEnabled else lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
    val permitted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val isMock = fix?.let { if (Build.VERSION.SDK_INT >= 31) it.isMock else @Suppress("DEPRECATION") it.isFromMockProvider } ?: false

    // Step 2: keep asking for a current location until it is accurate enough or 25 s pass.
    LaunchedEffect(selfie) {
        if (selfie == null || !permitted) return@LaunchedEffect
        searching = true
        val client = LocationServices.getFusedLocationProviderClient(ctx)
        val start = System.currentTimeMillis()
        try {
            while (System.currentTimeMillis() - start < 25_000) {
                val loc = withTimeoutOrNull(8_000) {
                    client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).await()
                }
                if (loc != null && (fix == null || loc.accuracy <= (fix!!.accuracy))) fix = loc
                if (fix != null && fix!!.accuracy <= GOOD_ACCURACY_M) break
            }
        } catch (e: SecurityException) { error = ctx.getString(R.string.checkin_location_off) }
        searching = false
    }

    val shift = when (val d = duty) { is DutyState.ReadyToStart -> d.shift; is DutyState.Upcoming -> d.shift; is DutyState.OnDuty -> d.shift; else -> null }
    val fence = Graph.repo.fence()
    val distance = fix?.let { f -> fence?.let { Geo.distanceOutsideM(it, f.latitude, f.longitude) } }
    val inside = distance?.let { d -> fence?.let { d <= it.leewayM } }
    val early = end && shift?.scheduled_end?.let { Duty.parse(it) }?.let { Instant.now().isBefore(it.minus(Duration.ofMinutes(15))) } == true

    fun submit() {
        val f = selfie ?: return; val loc = fix ?: return
        busy = true; error = null
        scope.launch {
            try {
                val battery = ctx.getSystemService(BatteryManager::class.java).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
                if (end) Graph.repo.checkOut(f, loc.latitude, loc.longitude, loc.accuracy, battery, isMock)
                else Graph.repo.checkIn(f, loc.latitude, loc.longitude, loc.accuracy, battery, isMock, shift)
                vm.recomputeDuty()
                onDone()
            } catch (e: Throwable) { error = Labels.error(ctx, e) } finally { busy = false }
        }
    }

    Screen(
        eyebrow = stringResource(if (end) R.string.checkout_eyebrow else R.string.checkin_eyebrow),
        title = stringResource(R.string.checkin_title), onBack = onBack,
        description = shift?.let { "${it.site_name ?: ""} · ${t.clock(it.scheduled_start)}–${t.clock(it.scheduled_end)}" } ?: me?.site?.name,
        bottom = {
            when {
                selfie == null -> BigButton(stringResource(R.string.capture), enabled = camera.ready.value && locationOn && permitted, loading = busy, onClick = {
                    busy = true
                    scope.launch {
                        runCatching {
                            val f = camera.takePicture(mediaFile(ctx, "${if (end) "end" else "start"}-${System.currentTimeMillis()}.jpg"))
                            withContext(Dispatchers.IO) { ImageCompressor.compressInPlace(f, maxKb, 720) }
                            selfie = f
                        }.onFailure { error = Labels.error(ctx, it) }
                        busy = false
                    }
                })
                else -> {
                    val blocked = isMock || (end && !live.locationEnabled && !locationOn)
                    BigButton(
                        stringResource(if (end) R.string.checkout_confirm else R.string.checkin_confirm),
                        enabled = fix != null && !blocked, loading = busy, tone = if (end) Tone.Signal else Tone.Olive, onClick = ::submit,
                    )
                    SecondaryButton(stringResource(R.string.retake), onClick = { selfie = null; fix = null })
                }
            }
        },
    ) {
        if (!permitted || !locationOn) {
            Banner(stringResource(R.string.checkin_location_off), Tone.Signal) {
                TextButton(onClick = { ctx.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)) }) { Text(stringResource(R.string.home_turn_on)) }
            }
        }
        Eyebrow(stringResource(R.string.checkin_step_selfie))
        Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(MaterialTheme.shapes.large)) {
            if (selfie == null) CameraPreview(camera, front = true, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f))
            else AsyncImage(model = selfie, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f))
        }
        if (selfie != null) {
            Spacer(Modifier.height(4.dp))
            Eyebrow(stringResource(R.string.checkin_step_gps))
            val acc = fix?.accuracy?.toInt()
            when {
                fix == null && searching -> { LinearProgressIndicator(Modifier.fillMaxWidth()); Text(stringResource(R.string.checkin_gps_waiting, 0), style = MaterialTheme.typography.bodyMedium) }
                fix == null -> Banner(stringResource(R.string.checkin_location_off), Tone.Signal)
                isMock -> Banner(stringResource(R.string.checkin_mock), Tone.Signal)
                acc != null && acc > GOOD_ACCURACY_M && searching -> { LinearProgressIndicator(Modifier.fillMaxWidth()); Text(stringResource(R.string.checkin_gps_waiting, acc), style = MaterialTheme.typography.bodyMedium) }
                acc != null && acc > GOOD_ACCURACY_M -> Banner(stringResource(R.string.checkin_gps_weak, acc), Tone.HalfDay)
                else -> Text(stringResource(R.string.checkin_gps_ok, acc ?: 0), style = MaterialTheme.typography.bodyMedium)
            }
            if (fix != null && !isMock) {
                Spacer(Modifier.height(4.dp))
                Eyebrow(stringResource(R.string.checkin_step_confirm))
                when (inside) {
                    true -> Banner(stringResource(R.string.checkin_inside), Tone.Present)
                    false -> Banner(stringResource(R.string.checkin_outside, distance!!.toInt()), Tone.HalfDay)
                    null -> Unit
                }
                if (early) Banner(stringResource(R.string.checkout_early, t.clock(shift?.scheduled_end)), Tone.HalfDay)
                if (end && !live.locationEnabled) Banner(stringResource(R.string.checkout_location_off_warning), Tone.Signal)
            }
        }
        if (error != null) Banner(error!!, Tone.Signal)
    }
}
