package com.guardforce.guard.ui.screens.lock

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.NumberPad
import com.guardforce.guard.ui.components.PinDots
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.launch

@Composable
fun LockScreen(onUnlocked: () -> Unit, onForgot: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val name = Graph.store.guardName ?: ""
    val canBiometric = remember {
        Graph.store.hasLocalPin() && BiometricManager.from(ctx).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun submit() {
        if (pin.length != 4 || busy) return
        busy = true
        scope.launch {
            val ok = runCatching { Graph.auth.unlock(pin) }.getOrDefault(false)
            busy = false
            if (ok) onUnlocked() else { error = ctx.getString(R.string.lock_wrong); pin = "" }
        }
    }
    LaunchedEffect(pin) { if (pin.length == 4) submit() }

    fun biometric() {
        val activity = ctx as? FragmentActivity ?: return
        val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(ctx), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                Graph.auth.stage.value.let { scope.launch { Graph.auth.unlockWithDevice(); onUnlocked() } }
            }
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle(ctx.getString(R.string.app_name)).setSubtitle(ctx.getString(R.string.lock_title))
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK).setNegativeButtonText(ctx.getString(R.string.cancel)).build())
    }

    Screen(
        eyebrow = stringResource(R.string.lock_eyebrow), title = stringResource(R.string.lock_title),
        description = if (name.isNotBlank()) stringResource(R.string.lock_hello, name) else null, scroll = false,
        bottom = {
            NumberPad(onDigit = { if (pin.length < 4) { error = null; pin += it } }, onBackspace = { pin = pin.dropLast(1) }, enabled = !busy)
            if (canBiometric) TextButton(onClick = ::biometric, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.lock_biometric)) }
            TextButton(onClick = onForgot, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.lock_forgot)) }
        },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { PinDots(4, pin.length, error != null) }
        if (error != null) Banner(error!!, Tone.Signal)
    }
}
