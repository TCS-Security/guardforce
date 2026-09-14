package com.guardforce.guard.ui.screens.leave

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
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
import com.guardforce.guard.api.LeaveBalance
import com.guardforce.guard.api.LeaveRequest
import com.guardforce.guard.ui.Labels
import com.guardforce.guard.ui.components.Banner
import com.guardforce.guard.ui.components.BigButton
import com.guardforce.guard.ui.components.CardBox
import com.guardforce.guard.ui.components.EmptyState
import com.guardforce.guard.ui.components.Loading
import com.guardforce.guard.ui.components.MonoText
import com.guardforce.guard.ui.components.Pill
import com.guardforce.guard.ui.components.Screen
import com.guardforce.guard.ui.components.SectionHeader
import com.guardforce.guard.ui.components.Tile
import com.guardforce.guard.ui.components.Tone
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Composable
fun LeaveScreen(onApply: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var balance by remember { mutableStateOf<LeaveBalance?>(null) }
    var requests by remember { mutableStateOf<List<LeaveRequest>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val t = Graph.repo.timeText()

    fun load() = scope.launch {
        try { balance = Graph.repo.leaveBalance(); requests = Graph.repo.listLeave(); error = null } catch (e: Throwable) { error = Labels.error(ctx, e); requests = requests ?: emptyList() }
    }
    LaunchedEffect(Unit) { load() }

    Screen(eyebrow = stringResource(R.string.leave_eyebrow), title = stringResource(R.string.leave_title), onBack = onBack,
        bottom = { BigButton(stringResource(R.string.leave_apply), onClick = onApply) }) {
        val b = balance ?: LeaveBalance(LocalDate.now().year)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tile(stringResource(R.string.leave_casual), "${b.casual_total - b.casual_used}", Modifier.weight(1f), sub = stringResource(R.string.leave_balance_left, b.casual_total - b.casual_used, b.casual_total))
            Tile(stringResource(R.string.leave_earned), "${b.earned_total - b.earned_used}", Modifier.weight(1f), sub = stringResource(R.string.leave_balance_left, b.earned_total - b.earned_used, b.earned_total))
            Tile(stringResource(R.string.leave_unpaid), "${b.unpaid_used}", Modifier.weight(1f))
        }
        if (error != null) Banner(error!!, Tone.Signal)
        SectionHeader(stringResource(R.string.leave_eyebrow))
        when (val list = requests) {
            null -> Loading()
            else -> if (list.isEmpty()) EmptyState(stringResource(R.string.leave_empty)) else list.forEach { lr ->
                val (label, tone) = Labels.leave(ctx, lr.status)
                CardBox {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(Labels.leaveType(ctx, lr.type), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)); Pill(label, tone)
                    }
                    Spacer(Modifier.height(4.dp))
                    MonoText(if (lr.start_date == lr.end_date) t.day(lr.start_date) else "${t.day(lr.start_date)} → ${t.day(lr.end_date)}")
                    lr.reason?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    lr.decision_note?.takeIf { it.isNotBlank() }?.let { Text("“$it”", style = MaterialTheme.typography.bodySmall) }
                    if (lr.status == "pending") TextButton(onClick = { scope.launch { runCatching { Graph.repo.cancelLeave(lr.id) }; load() } }) { Text(stringResource(R.string.leave_cancel)) }
                }
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun ApplyLeaveScreen(onDone: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var type by remember { mutableStateOf("casual") }
    var start by remember { mutableStateOf(LocalDate.now().plusDays(1)) }
    var end by remember { mutableStateOf(LocalDate.now().plusDays(1)) }
    var reason by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val t = Graph.repo.timeText()

    if (picking != null) {
        val initial = (if (picking == "start") start else end).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val state = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { picking = null },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { ms ->
                        val d = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                        if (picking == "start") { start = d; if (end.isBefore(d)) end = d } else end = d
                    }
                    picking = null
                }) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { picking = null }) { Text(stringResource(R.string.cancel)) } },
        ) { DatePicker(state = state) }
    }

    Screen(eyebrow = stringResource(R.string.leave_eyebrow), title = stringResource(R.string.leave_apply), onBack = onBack,
        bottom = {
            BigButton(stringResource(R.string.leave_submit), loading = busy, enabled = !end.isBefore(start), onClick = {
                busy = true; error = null
                scope.launch {
                    try { Graph.repo.applyLeave(type, start.toString(), end.toString(), reason.takeIf { it.isNotBlank() }); onDone() }
                    catch (e: Throwable) { error = Labels.error(ctx, e) } finally { busy = false }
                }
            })
        }) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("casual" to R.string.leave_casual, "earned" to R.string.leave_earned, "unpaid" to R.string.leave_unpaid).forEach { (k, label) ->
                FilterChip(selected = type == k, onClick = { type = k }, label = { Text(stringResource(label)) })
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.leave_from), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { picking = "start" }, modifier = Modifier.fillMaxWidth()) { Text(t.day(start.toString())) }
            }
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.leave_to), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { picking = "end" }, modifier = Modifier.fillMaxWidth()) { Text(t.day(end.toString())) }
            }
        }
        if (end.isBefore(start)) Banner(stringResource(R.string.leave_dates_invalid), Tone.Signal)
        OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text(stringResource(R.string.leave_reason)) }, modifier = Modifier.fillMaxWidth(), minLines = 3)
        if (error != null) Banner(error!!, Tone.Signal)
        Spacer(Modifier.width(1.dp))
    }
}
