package com.guardforce.guard.media

import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/** A handle the screen uses to take the picture once the preview is up. */
class CameraController(private val context: Context) {
    internal var capture: ImageCapture? = null
    val ready = mutableStateOf(false)

    suspend fun takePicture(target: File): File {
        val ic = capture ?: throw IllegalStateException("camera not ready")
        target.parentFile?.mkdirs()
        return suspendCoroutine { cont ->
            ic.takePicture(
                ImageCapture.OutputFileOptions.Builder(target).build(),
                ContextCompat.getMainExecutor(context),
                object : ImageCapture.OnImageSavedCallback {
                    override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) { cont.resume(target) }
                    override fun onError(exception: ImageCaptureException) { cont.resumeWithException(exception) }
                },
            )
        }
    }
}

@Composable
fun rememberCameraController(): CameraController {
    val context = LocalContext.current
    return remember { CameraController(context) }
}

/** CameraX preview bound to the composable's lifecycle. [front] selects the selfie camera. */
@Composable
fun CameraPreview(controller: CameraController, front: Boolean, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var provider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }

    LaunchedEffect(Unit) {
        val future = ProcessCameraProvider.getInstance(context)
        provider = suspendCoroutine { cont -> future.addListener({ cont.resume(future.get()) }, ContextCompat.getMainExecutor(context)) }
    }
    LaunchedEffect(provider, front) {
        val p = provider ?: return@LaunchedEffect
        val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
        val capture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setJpegQuality(85)
            .build()
        val selector = if (front && p.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
        p.unbindAll()
        runCatching { p.bindToLifecycle(lifecycleOwner, selector, preview, capture) }
            .onSuccess { controller.capture = capture; controller.ready.value = true }
    }
    DisposableEffect(Unit) { onDispose { provider?.unbindAll(); controller.ready.value = false } }

    Box(modifier) { AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize()) }
}

fun mediaFile(context: Context, name: String): File = File(context.filesDir, "media/$name").apply { parentFile?.mkdirs() }
