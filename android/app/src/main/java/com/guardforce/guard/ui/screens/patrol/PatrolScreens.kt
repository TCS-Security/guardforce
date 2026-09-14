package com.guardforce.guard.ui.screens.patrol

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
import com.guardforce.guard.api.PatrolInfo
import com.guardforce.guard.data.sync.LocalPhoto
import com.guardforce.guard.domain.Duty
import com.guardforce.guard.media.CameraPreview
import com.guardforce.guard.media.ImageCompressor
import com.guardforce.guard.media.mediaFile
import com.guardforce.guard.media.rememberCameraController
import com.guardforce.guard.tracking.TrackingService
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.EmptyState
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/** Server status overlaid with what this phone did offline. */
@Composable
fun effectivePatrols(vm: AppViewModel): List<PatrolInfo> {
    val home by vm.home.collectAsStateWithLifecycle()
    val overrides by Graph.repo.patrolOverrides.collectAsStateWithLifecycle(emptyList())
    return (home?.patrols ?: emptyList()).map { p -> overrides.firstOrNull { it.id == p.id }?.let { o -> p.copy(status = if (o.status == "completed" && p.status == "late") "late" else o.status) } ?: p }
}

@Composable
fun PatrolsScreen(vm: AppViewModel, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val patrols = effectivePatrols(vm)
    val duty by vm.duty.collectAsStateWithLifecycle()
    val t = Graph.repo.timeText()
    LaunchedEffect(Unit) { vm.refresh() }
    Screen(eyebrow = stringResource(R.string.patrols_eyebrow), title = stringResource(R.string.patrols_title), onBack = onBack) {
        if (patrols.isEmpty()) EmptyState(if (duty is com.guardforce.guard.domain.DutyState.OnDuty) stringResource(R.string.patrols_empty) else stringResource(R.string.patrols_need_shift))
        patrols.forEach { p ->
            val (label, tone) = Labels.patrol(ctx, p.status)
            val actionable = p.status == "scheduled" || p.status == "in_progress" || (p.status == "late" && p.ended_at == null)
            CardBox(onClick = if (actionable) ({ onOpen(p.id) }) else null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(p.route_name ?: "Patrol", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    Pill(label, tone)
                }
                Spacer(Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MonoText(stringResource(R.string.patrol_expected, t.clock(p.expected_at)))
                    p.duration_s?.let { MonoText(Labels.duration(ctx, it.toLong())) }
                    p.distance_m?.let { MonoText("${it.toInt()} m") }
                }
            }
        }
    }
}

@Composable
fun PatrolRunScreen(vm: AppViewModel, patrolId: String, onDone: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val patrols = effectivePatrols(vm)
    val patrol = patrols.firstOrNull { it.id == patrolId }
    val me by vm.me.collectAsStateWithLifecycle()
    val photos = remember { mutableStateListOf<LocalPhoto>() }
    var notes by remember { mutableStateOf("") }
    var camera by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var startedAt by remember { mutableStateOf<Long?>(null) }
    var tick by remember { mutableStateOf(0L) }
    val points by Graph.db.trail().countFlow(patrolId).collectAsStateWithLifecycle(0)
    val cam = rememberCameraController()
    val required = if (me?.site?.patrol_photo_required == true) (patrol?.min_photos ?: 1) else 0
    val maxKb = me?.config?.photo_max_kb ?: 250
    val t = Graph.repo.timeText()

    LaunchedEffect(patrol?.status) {
        if (patrol != null && startedAt == null) {
            startedAt = Duty.parse(patrol.started_at)?.toEpochMilli() ?: Graph.db.overrides().get("patrol", patrolId)?.atMs
        }
    }
    LaunchedEffect(startedAt) { while (startedAt != null) { delay(1000); tick = System.currentTimeMillis() } }

    val running = startedAt != null
    val elapsed = startedAt?.let { (tick.coerceAtLeast(it) - it) / 1000 } ?: 0L

    suspend fun currentLocation(): android.location.Location? {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return null
        return runCatching {
            withTimeoutOrNull(6_000) { LocationServices.getFusedLocationProviderClient(ctx).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).await() }
        }.getOrNull()
    }

    Screen(
        eyebrow = stringResource(R.string.patrols_eyebrow),
        title = patrol?.route_name ?: stringResource(R.string.patrol_run_title),
        onBack = { if (camera) camera = false else onBack() },
        description = patrol?.expected_at?.let { stringResource(R.string.patrol_expected, t.clock(it)) },
        scroll = !camera,
        bottom = {
            when {
                camera -> {
                    BigButton(stringResource(R.string.capture), enabled = cam.ready.value, loading = busy, onClick = {
                        busy = true
                        scope.launch {
                            runCatching {
                                val f = cam.takePicture(mediaFile(ctx, "patrol-$patrolId-${System.currentTimeMillis()}.jpg"))
                                withContext(Dispatchers.IO) { ImageCompressor.compressInPlace(f, maxKb, 1280) }
                                val loc = currentLocation()
                                photos += LocalPhoto(f.absolutePath, Graph.repo.patrolPhotoPath(patrolId), loc?.latitude, loc?.longitude, t.nowIso())
                                camera = false
                            }.onFailure { error = Labels.error(ctx, it) }
                            busy = false
                        }
                    })
                    SecondaryButton(stringResource(R.string.cancel), onClick = { camera = false })
                }
                !running -> BigButton(stringResource(R.string.patrol_start), loading = busy, onClick = {
                    busy = true
                    scope.launch {
                        Graph.repo.startPatrol(patrolId); TrackingService.setPatrol(ctx, patrolId)
                        startedAt = System.currentTimeMillis(); busy = false
                    }
                })
                else -> {
                    SecondaryButton(stringResource(R.string.patrol_add_photo), onClick = { camera = true })
                    BigButton(stringResource(R.string.patrol_complete), enabled = photos.size >= required, loading = busy, onClick = {
                        busy = true
                        scope.launch {
                            try {
                                Graph.repo.completePatrol(patrolId, photos.toList(), notes)
                                TrackingService.setPatrol(ctx, null)
                                onDone()
                            } catch (e: Throwable) { error = Labels.error(ctx, e) } finally { busy = false }
                        }
                    })
                }
            }
        },
    ) {
        if (camera) {
            Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(MaterialTheme.shapes.large)) { CameraPreview(cam, front = false, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f)) }
        } else {
            if (running) {
                CardBox {
                    Text(Labels.duration(ctx, elapsed).let { if (elapsed < 60) "${elapsed}s" else it }, style = MaterialTheme.typography.displayMedium)
                    MonoText(stringResource(R.string.patrol_elapsed, t.clock(startedAt!!), points))
                }
            }
            if (required > 0) Banner(stringResource(R.string.patrol_photo_required, required), if (photos.size >= required) Tone.Present else Tone.HalfDay)
            Text(stringResource(R.string.patrol_photos, photos.size, required), style = MaterialTheme.typography.titleMedium)
            if (photos.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(photos) { p -> AsyncImage(model = java.io.File(p.file), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(96.dp).clip(MaterialTheme.shapes.small)) }
                }
            }
            if (running) OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text(stringResource(R.string.patrol_notes)) }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            if (error != null) Banner(error!!, Tone.Signal)
        }
    }
}
