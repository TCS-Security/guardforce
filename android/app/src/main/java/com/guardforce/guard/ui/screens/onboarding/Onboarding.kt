package com.guardforce.guard.ui.screens.onboarding

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.domain.Phone
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.NumberPad
import com.guardforce.guard.ui.components.PinDots
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.launch

@Composable
fun PhoneScreen(onSent: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var phone by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Screen(
        eyebrow = stringResource(R.string.onboarding_eyebrow), title = stringResource(R.string.onboarding_title),
        description = stringResource(R.string.onboarding_body),
        bottom = {
            BigButton(stringResource(R.string.send_otp), loading = busy, onClick = {
                val e164 = Phone.toE164(phone)
                if (e164 == null) { error = ctx.getString(R.string.phone_invalid); return@BigButton }
                busy = true; error = null
                scope.launch {
                    try { Graph.auth.requestOtp(e164); onSent() } catch (t: Throwable) { error = Labels.error(ctx, t) } finally { busy = false }
                }
            })
        },
    ) {
        OutlinedTextField(
            value = phone, onValueChange = { if (it.length <= 13) phone = it.filter { c -> c.isDigit() || c == '+' } },
            label = { Text(stringResource(R.string.phone_label)) }, placeholder = { Text(stringResource(R.string.phone_hint)) },
            prefix = { Text(stringResource(R.string.phone_prefix) + " ") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), singleLine = true,
            modifier = Modifier.fillMaxWidth(), isError = error != null,
        )
        if (error != null) Banner(error!!, Tone.Signal)
    }
}

@Composable
fun OtpScreen(onVerified: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var code by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val phone = Graph.auth.pendingPhone ?: ""

    fun submit() {
        if (code.length != 6 || busy) return
        busy = true; error = null
        scope.launch {
            try { Graph.auth.verifyOtp(code); onVerified() } catch (t: Throwable) { error = Labels.error(ctx, t); code = "" } finally { busy = false }
        }
    }
    LaunchedEffect(code) { if (code.length == 6) submit() }

    Screen(
        eyebrow = stringResource(R.string.otp_eyebrow), title = stringResource(R.string.otp_title),
        description = stringResource(R.string.otp_body, Phone.display(phone)), onBack = onBack, scroll = false,
        bottom = {
            NumberPad(onDigit = { if (code.length < 6) code += it }, onBackspace = { code = code.dropLast(1) }, enabled = !busy)
            Spacer(Modifier.height(4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { scope.launch { runCatching { Graph.auth.requestOtp(phone) } } }) { Text(stringResource(R.string.otp_resend)) }
                TextButton(onClick = onBack) { Text(stringResource(R.string.otp_change_number)) }
            }
        },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            PinDots(6, code.length, error != null)
            MonoText(code.padEnd(6, '·').chunked(3).joinToString("  "), size = 28, color = MaterialTheme.colorScheme.onSurface)
        }
        if (error != null) Banner(error!!, Tone.Signal)
    }
}

/** Runs claim_guard_account after OTP; explains the two ways it can fail. */
@Composable
fun ClaimScreen(onClaimed: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(true) }
    fun run() {
        busy = true; error = null
        scope.launch {
            try { Graph.auth.claim(); Graph.repo.refreshMe(); onClaimed() } catch (t: Throwable) { error = Labels.error(ctx, t) } finally { busy = false }
        }
    }
    LaunchedEffect(Unit) { run() }
    Screen(
        eyebrow = stringResource(R.string.otp_eyebrow), title = if (busy) stringResource(R.string.loading) else stringResource(R.string.blocked_title),
        bottom = {
            if (!busy) {
                BigButton(stringResource(R.string.retry), onClick = { run() })
                SecondaryButton(stringResource(R.string.profile_sign_out), onClick = { scope.launch { Graph.auth.signOut() } })
            }
        },
    ) {
        if (error != null) Banner(error!!, Tone.Signal)
    }
}

@Composable
fun SetPinScreen(change: Boolean, onDone: () -> Unit, onBack: (() -> Unit)? = null) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var first by remember { mutableStateOf("") }
    var second by remember { mutableStateOf("") }
    var confirming by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val current = if (confirming) second else first

    fun onDigit(c: Char) {
        error = null
        if (!confirming) { if (first.length < 4) first += c; if (first.length == 4) confirming = true }
        else if (second.length < 4) {
            second += c
            if (second.length == 4) {
                if (second != first) { error = ctx.getString(R.string.pin_mismatch); first = ""; second = ""; confirming = false }
                else {
                    busy = true
                    scope.launch {
                        try { Graph.auth.setPin(first); onDone() } catch (t: Throwable) { error = Labels.error(ctx, t); first = ""; second = ""; confirming = false } finally { busy = false }
                    }
                }
            }
        }
    }

    Screen(
        eyebrow = stringResource(R.string.pin_set_eyebrow),
        title = if (confirming) stringResource(R.string.pin_confirm_title) else stringResource(R.string.pin_set_title),
        description = stringResource(R.string.pin_set_body), onBack = if (change) onBack else null, scroll = false,
        bottom = { NumberPad(onDigit = ::onDigit, onBackspace = { if (confirming) second = second.dropLast(1) else first = first.dropLast(1) }, enabled = !busy) },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { PinDots(4, current.length, error != null) }
        if (error != null) Banner(error!!, Tone.Signal)
    }
}

private data class Perm(val title: Int, val why: Int)

@Composable
fun PermissionsScreen(onDone: () -> Unit) {
    val ctx = LocalContext.current
    fun granted(p: String) = ContextCompat.checkSelfPermission(ctx, p) == android.content.pm.PackageManager.PERMISSION_GRANTED
    var tick by remember { mutableStateOf(0) }
    val fine = remember(tick) { granted(Manifest.permission.ACCESS_FINE_LOCATION) }
    val background = remember(tick) { Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION) }
    val camera = remember(tick) { granted(Manifest.permission.CAMERA) }
    val notif = remember(tick) { Build.VERSION.SDK_INT < 33 || granted(Manifest.permission.POST_NOTIFICATIONS) }
    val battery = remember(tick) { ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName) }

    val multi = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { tick++ }
    val single = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    val settings = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { tick++ }

    val allCore = fine && camera && notif
    Screen(
        eyebrow = stringResource(R.string.perm_eyebrow), title = stringResource(R.string.perm_title), description = stringResource(R.string.perm_body),
        bottom = {
            BigButton(stringResource(R.string.perm_continue), enabled = allCore, onClick = { Graph.store.permissionsDone = true; onDone() })
        },
    ) {
        PermRow(stringResource(R.string.perm_location), stringResource(R.string.perm_location_why), fine && background) {
            if (!fine) multi.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            else if (!background && Build.VERSION.SDK_INT >= 29) single.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
        PermRow(stringResource(R.string.perm_camera), stringResource(R.string.perm_camera_why), camera) { single.launch(Manifest.permission.CAMERA) }
        PermRow(stringResource(R.string.perm_notifications), stringResource(R.string.perm_notifications_why), notif) {
            if (Build.VERSION.SDK_INT >= 33) single.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        PermRow(stringResource(R.string.perm_battery), stringResource(R.string.perm_battery_why), battery) {
            @Suppress("BatteryLife")
            settings.launch(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}")))
        }
        TextButton(onClick = { settings.launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))) }) {
            Text(stringResource(R.string.perm_open_settings))
        }
    }
}

@Composable
private fun PermRow(title: String, why: String, granted: Boolean, request: () -> Unit) {
    CardBox(onClick = if (granted) null else request) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            if (granted) Pill(stringResource(R.string.perm_granted), Tone.Present) else Pill(stringResource(R.string.perm_grant), Tone.Olive)
        }
        Spacer(Modifier.height(4.dp))
        Text(why, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
