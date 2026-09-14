package com.guardforce.guard.ui.screens.notifications

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.api.NotificationItem
import com.guardforce.guard.domain.Duty
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.Dot
import com.guardforce.guard.ui.components.EmptyState
import com.guardforce.guard.ui.components.Loading
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.launch

@Composable
fun NotificationsScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<NotificationItem>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val t = Graph.repo.timeText()
    LaunchedEffect(Unit) { try { items = Graph.repo.listNotifications() } catch (e: Throwable) { error = Labels.error(ctx, e); items = emptyList() } }
    val list = items
    Screen(eyebrow = stringResource(R.string.notifications_eyebrow), title = stringResource(R.string.notifications_title), onBack = onBack,
        header = {
            if (list?.any { it.read_at == null } == true) TextButton(onClick = {
                scope.launch { runCatching { Graph.repo.markRead(list.filter { it.read_at == null }.map { it.id }) }; items = list.map { it.copy(read_at = it.read_at ?: t.nowIso()) }; Graph.repo.refreshHomeQuietly() }
            }) { Text(stringResource(R.string.notifications_mark_read)) }
        }) {
        if (error != null) Banner(error!!, Tone.Signal)
        when {
            list == null -> Loading()
            list.isEmpty() -> EmptyState(stringResource(R.string.notifications_empty))
            else -> list.forEach { n ->
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (n.read_at == null) { Dot(Tone.Signal); Spacer(Modifier.width(8.dp)) }
                        Text(n.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        MonoText(Duty.parse(n.created_at)?.toEpochMilli()?.let { Labels.relative(ctx, t.relative(it)) } ?: "")
                    }
                    n.body?.takeIf { it.isNotBlank() }?.let { Spacer(Modifier.height(4.dp)); Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        }
    }
}
