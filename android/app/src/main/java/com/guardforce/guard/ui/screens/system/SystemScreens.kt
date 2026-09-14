package com.guardforce.guard.ui.screens.system

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.guardforce.guard.BuildConfig
import com.guardforce.guard.R
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import com.guardforce.guard.ui.components.Tone

@Composable
fun ForceUpdateScreen(minVersion: String) {
    val ctx = LocalContext.current
    Screen(eyebrow = stringResource(R.string.brand_eyebrow), title = stringResource(R.string.update_title),
        description = stringResource(R.string.update_body, minVersion, BuildConfig.VERSION_NAME),
        bottom = { BigButton(stringResource(R.string.update_button), onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PLAY_STORE_URL))) }) }) {}
}

@Composable
fun BlockedScreen(reason: String, onSignOut: () -> Unit) {
    Screen(eyebrow = stringResource(R.string.brand_eyebrow), title = stringResource(R.string.blocked_title),
        bottom = { SecondaryButton(stringResource(R.string.profile_sign_out), onClick = onSignOut) }) {
        Banner(stringResource(if (reason == "inactive") R.string.blocked_inactive else R.string.blocked_suspended), Tone.Signal)
    }
}
