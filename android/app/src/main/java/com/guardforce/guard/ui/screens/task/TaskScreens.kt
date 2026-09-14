package com.guardforce.guard.ui.screens.task

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import com.guardforce.guard.api.TaskInfo
import com.guardforce.guard.data.sync.LocalPhoto
import com.guardforce.guard.media.CameraPreview
import com.guardforce.guard.media.ImageCompressor
import com.guardforce.guard.media.mediaFile
import com.guardforce.guard.media.rememberCameraController
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File

@Composable
fun effectiveTasks(vm: AppViewModel): List<TaskInfo> {
    val home by vm.home.collectAsStateWithLifecycle()
    val overrides by Graph.repo.taskOverrides.collectAsStateWithLifecycle(emptyList())
    return (home?.tasks ?: emptyList()).map { t -> overrides.firstOrNull { it.id == t.id }?.let { o -> t.copy(status = o.status) } ?: t }.filter { it.status != "done" }
}

@Composable
fun TasksScreen(vm: AppViewModel, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val tasks = effectiveTasks(vm)
    val t = Graph.repo.timeText()
    LaunchedEffect(Unit) { vm.refresh() }
    Screen(eyebrow = stringResource(R.string.tasks_eyebrow), title = stringResource(R.string.tasks_title), onBack = onBack) {
        if (tasks.isEmpty()) EmptyState(stringResource(R.string.tasks_empty))
        tasks.forEach { task ->
            CardBox(onClick = { onOpen(task.id) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(task.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    if (task.status == "in_progress") Pill(stringResource(R.string.patrol_status_in_progress), Tone.Olive)
                }
                Spacer(Modifier.height(4.dp))
                MonoText(task.due_at?.let { stringResource(R.string.task_due, t.clock(it)) } ?: stringResource(R.string.task_no_due))
                if (task.photo_required) { Spacer(Modifier.height(4.dp)); Text(stringResource(R.string.task_photo_required), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable
fun TaskDoScreen(vm: AppViewModel, taskId: String, onDone: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val task = effectiveTasks(vm).firstOrNull { it.id == taskId } ?: vm.home.collectAsStateWithLifecycle().value?.tasks?.firstOrNull { it.id == taskId }
    val me by vm.me.collectAsStateWithLifecycle()
    var photo by remember { mutableStateOf<LocalPhoto?>(null) }
    var note by remember { mutableStateOf("") }
    var camera by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val cam = rememberCameraController()
    val maxKb = me?.config?.photo_max_kb ?: 250
    val t = Graph.repo.timeText()
    val needPhoto = task?.photo_required == true

    LaunchedEffect(taskId) { if (task?.status == "pending") Graph.repo.startTask(taskId) }

    suspend fun currentLocation(): android.location.Location? {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return null
        return runCatching { withTimeoutOrNull(6_000) { LocationServices.getFusedLocationProviderClient(ctx).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).await() } }.getOrNull()
    }

    Screen(
        eyebrow = stringResource(R.string.tasks_eyebrow), title = task?.title ?: "", onBack = { if (camera) camera = false else onBack() },
        description = task?.description, scroll = !camera,
        bottom = {
            if (camera) {
                BigButton(stringResource(R.string.capture), enabled = cam.ready.value, loading = busy, onClick = {
                    busy = true
                    scope.launch {
                        runCatching {
                            val f = cam.takePicture(mediaFile(ctx, "task-$taskId-${System.currentTimeMillis()}.jpg"))
                            withContext(Dispatchers.IO) { ImageCompressor.compressInPlace(f, maxKb, 1280) }
                            val loc = currentLocation()
                            photo = LocalPhoto(f.absolutePath, Graph.repo.taskPhotoPath(taskId), loc?.latitude, loc?.longitude, t.nowIso())
                            camera = false
                        }.onFailure { error = Labels.error(ctx, it) }
                        busy = false
                    }
                })
                SecondaryButton(stringResource(R.string.cancel), onClick = { camera = false })
            } else {
                SecondaryButton(stringResource(R.string.task_take_photo), onClick = { camera = true })
                BigButton(stringResource(R.string.task_complete), enabled = task != null && (!needPhoto || photo != null), loading = busy, onClick = {
                    busy = true
                    scope.launch {
                        try {
                            val loc = photo?.let { null } ?: currentLocation()
                            Graph.repo.completeTask(taskId, photo, note, photo?.lat ?: loc?.latitude, photo?.lng ?: loc?.longitude)
                            onDone()
                        } catch (e: Throwable) { error = Labels.error(ctx, e) } finally { busy = false }
                    }
                })
            }
        },
    ) {
        if (camera) {
            Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(MaterialTheme.shapes.large)) { CameraPreview(cam, front = false, modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f)) }
        } else {
            task?.due_at?.let { MonoText(stringResource(R.string.task_due, t.clock(it))) }
            if (needPhoto) Banner(stringResource(R.string.task_photo_required), if (photo != null) Tone.Present else Tone.HalfDay)
            photo?.let { AsyncImage(model = File(it.file), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(MaterialTheme.shapes.medium)) }
            OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text(stringResource(R.string.task_note)) }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            if (error != null) Banner(error!!, Tone.Signal)
        }
    }
}
