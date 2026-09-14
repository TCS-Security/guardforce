package com.guardforce.guard.ui.screens.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.guardforce.guard.Graph
import com.guardforce.guard.R
import com.guardforce.guard.api.ShiftRecord
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.EmptyState
import com.guardforce.guard.ui.components.Loading
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.Tile
import com.guardforce.guard.ui.components.Tone

@Composable
fun HistoryScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    var shifts by remember { mutableStateOf<List<ShiftRecord>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val t = Graph.repo.timeText()
    LaunchedEffect(Unit) {
        try { shifts = Graph.repo.listShifts(30) } catch (e: Throwable) { error = Labels.error(ctx, e); shifts = emptyList() }
    }
    val list = shifts
    Screen(eyebrow = stringResource(R.string.history_eyebrow), title = stringResource(R.string.history_title), onBack = onBack) {
        if (error != null) Banner(error!!, Tone.Signal)
        when {
            list == null -> Loading()
            list.isEmpty() -> EmptyState(stringResource(R.string.history_empty))
            else -> {
                val done = list.filter { it.status in setOf("completed", "void_location_off", "absent") }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Tile(stringResource(R.string.attendance_present), "${done.count { it.attendance == "present" }}", Modifier.weight(1f), Tone.Present)
                    Tile(stringResource(R.string.attendance_half_day), "${done.count { it.attendance == "half_day" }}", Modifier.weight(1f), Tone.HalfDay)
                    Tile(stringResource(R.string.attendance_absent), "${done.count { it.attendance == "absent" }}", Modifier.weight(1f), Tone.Absent)
                }
                list.forEach { s ->
                    val (label, tone) = Labels.attendance(ctx, s.attendance)
                    CardBox {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(t.day(s.shift_date), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                            if (s.status == "scheduled") Pill(stringResource(R.string.patrol_status_scheduled), Tone.Neutral) else Pill(label, tone)
                        }
                        Spacer(Modifier.height(2.dp))
                        Text(s.sites?.name ?: "", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            MonoText("${t.clock(s.started_at ?: s.scheduled_start)} → ${t.clock(s.ended_at ?: s.scheduled_end)}")
                            if (s.worked_minutes > 0) MonoText(Labels.duration(ctx, s.worked_minutes * 60L))
                            if (s.away_seconds > 60) MonoText(stringResource(R.string.home_away, Labels.duration(ctx, s.away_seconds.toLong())))
                        }
                        if (s.flags.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                s.flags.take(3).forEach { Pill(Labels.flag(ctx, it), if (it == "LOCATION_OFF" || it == "TAMPER_SUSPECTED") Tone.Absent else Tone.HalfDay) }
                            }
                        }
                    }
                }
            }
        }
    }
}
