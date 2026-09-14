package com.guardforce.guard.ui.screens.profile

import android.content.Intent
import android.net.Uri
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.guardforce.guard.BuildConfig
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.domain.Phone
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.KvRow
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import com.guardforce.guard.ui.components.SectionHeader
import com.guardforce.guard.ui.components.Tone

@Composable
fun ProfileScreen(vm: AppViewModel, onChangePin: () -> Unit, onRetakeSelfie: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val me by vm.me.collectAsStateWithLifecycle()
    var confirmSignOut by remember { mutableStateOf(false) }
    var selfieUrl by remember { mutableStateOf<String?>(null) }
    val current = AppCompatDelegate.getApplicationLocales().toLanguageTags().take(2).ifBlank { "en" }
    val g = me?.guard

    LaunchedEffect(g?.registration_selfie_path) {
        g?.registration_selfie_path?.let { selfieUrl = runCatching { Graph.repo.signedUrl("selfies", it) }.getOrNull() }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text(stringResource(R.string.profile_sign_out)) },
            text = { Text(stringResource(R.string.profile_sign_out_confirm)) },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; vm.signOut() }) { Text(stringResource(R.string.profile_sign_out)) } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }

    Screen(eyebrow = stringResource(R.string.profile_eyebrow), title = g?.full_name ?: "", onBack = onBack, description = g?.designation) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            if (selfieUrl != null) AsyncImage(model = selfieUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(72.dp).clip(MaterialTheme.shapes.medium))
            TextButton(onClick = onRetakeSelfie) { Text(stringResource(R.string.profile_retake_selfie)) }
        }
        KvRow(stringResource(R.string.profile_code), g?.employee_code ?: "–", mono = true)
        KvRow(stringResource(R.string.profile_phone), g?.phone?.let { Phone.display(it) } ?: "–", mono = true)
        KvRow(stringResource(R.string.profile_site), me?.site?.name ?: "–")
        KvRow(stringResource(R.string.profile_supervisor), me?.supervisor?.name ?: "–")
        KvRow(stringResource(R.string.profile_agency), me?.agency?.name ?: "–")
        me?.supervisor?.phone?.let { phone ->
            SecondaryButton(stringResource(R.string.profile_call_supervisor), onClick = { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))) })
        }

        SectionHeader(stringResource(R.string.profile_kyc)) {
            if (me?.kyc_missing.isNullOrEmpty()) Pill(stringResource(R.string.profile_kyc_complete), Tone.Present)
        }
        listOf("aadhaar", "pan", "police_verification", "guard_kyc", "marksheet").forEach { type ->
            val doc = me?.documents?.firstOrNull { it.type == type }
            val (label, tone) = Labels.docStatus(ctx, doc?.takeIf { it.has_file }?.status)
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(Labels.docType(ctx, type), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f)); Pill(label, tone)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))
        }
        me?.kyc_missing?.takeIf { it.isNotEmpty() }?.let { Text(stringResource(R.string.profile_kyc_missing, it.joinToString(", ") { g2 -> Labels.kycGap(ctx, g2) }), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }

        SectionHeader(stringResource(R.string.profile_language))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = current == "en", onClick = { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("en")) }, label = { Text(stringResource(R.string.profile_language_en)) })
            FilterChip(selected = current == "hi", onClick = { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags("hi")) }, label = { Text(stringResource(R.string.profile_language_hi)) })
        }

        SectionHeader("")
        SecondaryButton(stringResource(R.string.profile_change_pin), onClick = onChangePin)
        SecondaryButton(stringResource(R.string.profile_sign_out), onClick = { confirmSignOut = true })
        Spacer(Modifier.height(8.dp))
        MonoText(stringResource(R.string.profile_version, BuildConfig.VERSION_NAME, BuildConfig.OTA_CHANNEL))
    }
}
