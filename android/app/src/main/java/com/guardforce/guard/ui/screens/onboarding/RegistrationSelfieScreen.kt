package com.guardforce.guard.ui.screens.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
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
import coil3.compose.AsyncImage
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.media.CameraPreview
import com.guardforce.guard.media.ImageCompressor
import com.guardforce.guard.media.mediaFile
import com.guardforce.guard.media.rememberCameraController
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SecondaryButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun RegistrationSelfieScreen(onDone: () -> Unit, onBack: (() -> Unit)? = null) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val camera = rememberCameraController()
    var shot by remember { mutableStateOf<File?>(null) }
    var busy by remember { mutableStateOf(false) }
    val maxKb = Graph.repo.me.value?.config?.selfie_max_kb ?: 120

    Screen(
        eyebrow = stringResource(R.string.selfie_reg_eyebrow), title = stringResource(R.string.selfie_reg_title),
        description = stringResource(R.string.selfie_reg_body), onBack = onBack, scroll = false,
        bottom = {
            if (shot == null) {
                BigButton(stringResource(R.string.capture), enabled = camera.ready.value, loading = busy, onClick = {
                    busy = true
                    scope.launch {
                        runCatching {
                            val f = camera.takePicture(mediaFile(ctx, "reg-${System.currentTimeMillis()}.jpg"))
                            withContext(Dispatchers.IO) { ImageCompressor.compressInPlace(f, maxKb, 720) }
                            shot = f
                        }
                        busy = false
                    }
                })
            } else {
                BigButton(stringResource(R.string.selfie_reg_done), loading = busy, onClick = {
                    busy = true
                    scope.launch { Graph.repo.setRegistrationSelfie(shot!!); busy = false; onDone() }
                })
                SecondaryButton(stringResource(R.string.retake), onClick = { shot = null })
            }
        },
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(MaterialTheme.shapes.large)) {
            if (shot == null) CameraPreview(camera, front = true, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f))
            else AsyncImage(model = shot, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f))
        }
    }
}
