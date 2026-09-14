package com.guardforce.guard.ui.screens.home

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.guardforce.guard.R
import com.guardforce.guard.api.ShiftInfo
import com.guardforce.guard.domain.DutyState
import com.guardforce.guard.ui.AppViewModel
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.Dot
import com.guardforce.guard.ui.components.Eyebrow
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SectionHeader
import com.guardforce.guard.ui.components.Tile
import com.guardforce.guard.ui.components.Tone
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen(vm: AppViewModel, nav: (String) -> Unit) {
    val ctx = LocalContext.current
    val me by vm.me.collectAsStateWithLifecycle()
    val home by vm.home.collectAsStateWithLifecycle()
    val duty by vm.duty.collectAsStateWithLifecycle()
    val live by vm.live.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val pending by vm.pending.collectAsStateWithLifecycle()
    val t = vm.let { com.guardforce.guard.Graph.repo.timeText() }

    LaunchedEffect(Unit) { vm.refresh() }

    val guard = me?.guard
    val site = me?.site
    val onDuty = duty is DutyState.OnDuty || duty is DutyState.StartingOffline

    Screen(
        eyebrow = stringResource(R.string.home_eyebrow_today, t.todayLong()),
        title = guard?.full_name ?: "",
        description = listOfNotNull(guard?.designation, site?.name).joinToString(" · ").ifBlank { null },
        header = {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!online) Pill(stringResource(R.string.offline_banner), Tone.Neutral)
                if (pending > 0) Pill(stringResource(R.string.home_pending_sync, pending), Tone.HalfDay)
                else if (online) Pill(stringResource(R.string.home_synced), Tone.Present)
            }
        },
    ) {
        if (onDuty && !live.locationEnabled) {
            Banner(stringResource(R.string.home_location_off), Tone.Signal) {
                TextButton(onClick = { ctx.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }) { Text(stringResource(R.string.home_turn_on)) }
            }
        }
        me?.takeIf { it.kyc_missing.isNotEmpty() }?.let { m ->
            Banner(stringResource(R.string.home_kyc_incomplete, m.kyc_missing.joinToString(", ") { Labels.kycGap(ctx, it) }), Tone.HalfDay)
        }

        DutyCard(duty, live, t, nav)

        if (onDuty) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val fenceText = when (live.inFence) {
                    true -> stringResource(R.string.home_in_fence)
                    false -> stringResource(R.string.home_out_fence, (live.distanceOutsideM ?: 0.0).toInt())
                    null -> stringResource(R.string.home_fence_unknown)
                }
                Tile("GPS", fenceText, Modifier.weight(1f), tone = when (live.inFence) { true -> Tone.Present; false -> Tone.Signal; null -> Tone.Neutral },
                    sub = live.lastFixMs?.let { stringResource(R.string.home_last_ping, Labels.relative(ctx, t.relative(it))) })
                Tile(stringResource(R.string.home_battery, live.batteryPct ?: 0).substringBefore(' '), "${live.batteryPct ?: "–"}%", Modifier.weight(1f),
                    tone = if ((live.batteryPct ?: 100) < 15) Tone.Signal else null, sub = if (live.intervalS > 0) "${live.intervalS}s" else null)
            }
        }

        SectionHeader(stringResource(R.string.home_patrols)) { TextButton(onClick = { nav("patrols") }) { Text("→") } }
        val patrols = home?.patrols ?: emptyList()
        if (patrols.isEmpty()) Text(if (onDuty) stringResource(R.string.home_patrols_none) else stringResource(R.string.patrols_need_shift), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        else patrols.take(3).forEach { p ->
            val (label, tone) = Labels.patrol(ctx, p.status)
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Dot(tone); Spacer(Modifier.width(10.dp))
                Text(p.route_name ?: "Patrol", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                MonoText(t.clock(p.expected_at)); Spacer(Modifier.width(8.dp)); Pill(label, tone)
            }
        }

        SectionHeader(stringResource(R.string.home_tasks)) { TextButton(onClick = { nav("tasks") }) { Text("→") } }
        val tasks = home?.tasks ?: emptyList()
        if (tasks.isEmpty()) Text(stringResource(R.string.home_tasks_none), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        else tasks.take(3).forEach { task ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(task.title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                MonoText(task.due_at?.let { t.clock(it) } ?: "")
            }
        }

        SectionHeader("")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NavTile(stringResource(R.string.home_leave), Modifier.weight(1f)) { nav("leave") }
            NavTile(stringResource(R.string.home_history), Modifier.weight(1f)) { nav("history") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NavTile(stringResource(R.string.home_notifications) + (home?.unread_notifications?.takeIf { it > 0 }?.let { " · $it" } ?: ""), Modifier.weight(1f)) { nav("notifications") }
            NavTile(stringResource(R.string.home_profile), Modifier.weight(1f)) { nav("profile") }
        }
    }
}

@Composable
private fun NavTile(label: String, modifier: Modifier, onClick: () -> Unit) {
    CardBox(modifier, onClick = onClick) { Text(label, style = MaterialTheme.typography.titleMedium) }
}

@Composable
private fun DutyCard(duty: DutyState?, live: com.guardforce.guard.tracking.LiveStatus, t: com.guardforce.guard.domain.TimeText, nav: (String) -> Unit) {
    val ctx = LocalContext.current
    CardBox {
        when (val d = duty) {
            null -> Text(stringResource(R.string.loading))
            is DutyState.NoShift -> {
                Eyebrow(stringResource(R.string.home_no_shift_title))
                Spacer(Modifier.height(6.dp))
                Text(stringResource(R.string.home_no_shift_body), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (d.canStartAdHoc) { Spacer(Modifier.height(14.dp)); BigButton(stringResource(R.string.home_start_shift), onClick = { nav("checkin") }) }
            }
            is DutyState.Upcoming -> { ShiftLine(d.shift, t, stringResource(R.string.home_upcoming_title)); Spacer(Modifier.height(14.dp)); BigButton(stringResource(R.string.home_start_shift), onClick = { nav("checkin") }, tone = Tone.Neutral) }
            is DutyState.ReadyToStart -> { ShiftLine(d.shift, t, stringResource(R.string.home_upcoming_title)); Spacer(Modifier.height(14.dp)); BigButton(stringResource(R.string.home_start_shift), onClick = { nav("checkin") }) }
            is DutyState.StartingOffline -> {
                Eyebrow(stringResource(R.string.home_on_duty)); Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.home_since, t.clock(d.sinceMs)), style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(6.dp)); Pill(stringResource(R.string.checkin_queued), Tone.HalfDay)
                Spacer(Modifier.height(14.dp)); BigButton(stringResource(R.string.home_end_shift), onClick = { nav("checkout") }, tone = Tone.Signal)
            }
            is DutyState.OnDuty -> {
                Row(verticalAlignment = Alignment.CenterVertically) { Dot(Tone.Present); Spacer(Modifier.width(8.dp)); Eyebrow(stringResource(R.string.home_on_duty)) }
                Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.home_since, t.clock(d.sinceMs)), style = MaterialTheme.typography.headlineMedium)
                d.shift?.let { s ->
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        s.scheduled_end?.let { MonoText("→ " + t.clock(it)) }
                        if (s.late_by_min > 0) Pill(stringResource(R.string.home_late, s.late_by_min), Tone.HalfDay)
                        if (s.away_seconds > 0) Pill(stringResource(R.string.home_away, Labels.duration(ctx, s.away_seconds.toLong())), Tone.HalfDay)
                        s.flags.filter { it != "LATE_START" }.forEach { Pill(Labels.flag(ctx, it), if (it == "LOCATION_OFF" || it == "TAMPER_SUSPECTED") Tone.Absent else Tone.HalfDay) }
                    }
                }
                Spacer(Modifier.height(14.dp))
                BigButton(stringResource(R.string.home_end_shift), onClick = { nav("checkout") }, tone = Tone.Signal)
            }
            is DutyState.EndingOffline -> { Eyebrow(stringResource(R.string.home_shift_ended)); Spacer(Modifier.height(6.dp)); Pill(stringResource(R.string.checkin_queued), Tone.HalfDay) }
            is DutyState.Ended -> {
                Eyebrow(stringResource(R.string.home_shift_ended)); Spacer(Modifier.height(4.dp))
                val (label, tone) = Labels.attendance(ctx, d.shift.attendance)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.home_worked, Labels.duration(ctx, d.shift.worked_minutes * 60L)), style = MaterialTheme.typography.headlineSmall)
                    Pill(label, tone)
                }
                if (d.shift.status == "void_location_off") { Spacer(Modifier.height(6.dp)); Banner(stringResource(R.string.home_void), Tone.Signal) }
                if (d.shift.away_seconds > 0) { Spacer(Modifier.height(4.dp)); MonoText(stringResource(R.string.home_away, Labels.duration(ctx, d.shift.away_seconds.toLong()))) }
            }
        }
    }
}

@Composable
private fun ShiftLine(s: ShiftInfo, t: com.guardforce.guard.domain.TimeText, eyebrow: String) {
    Eyebrow(eyebrow); Spacer(Modifier.height(4.dp))
    Text(stringResource(R.string.home_scheduled, t.clock(s.scheduled_start), t.clock(s.scheduled_end)), style = MaterialTheme.typography.headlineMedium)
    Text(listOfNotNull(s.shift_type, s.site_name).joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
