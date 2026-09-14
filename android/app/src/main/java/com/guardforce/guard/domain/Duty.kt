package com.guardforce.guard.domain

import com.guardforce.guard.api.ShiftInfo
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

/** What the guard sees on the home card. Derived from server state plus what is queued locally. */
sealed class DutyState {
    /** Nothing rostered; ad-hoc start allowed when [canStartAdHoc]. */
    data class NoShift(val canStartAdHoc: Boolean) : DutyState()
    /** A rostered shift more than [startWindow] ahead. */
    data class Upcoming(val shift: ShiftInfo) : DutyState()
    /** Rostered shift inside the start window. */
    data class ReadyToStart(val shift: ShiftInfo) : DutyState()
    /** Check-in saved on the phone, not yet confirmed by the server. */
    data class StartingOffline(val shift: ShiftInfo?, val siteId: String, val sinceMs: Long) : DutyState()
    data class OnDuty(val shift: ShiftInfo?, val serverShiftId: String?, val siteId: String, val sinceMs: Long) : DutyState()
    /** Check-out saved on the phone, waiting for the server. */
    data class EndingOffline(val shift: ShiftInfo?) : DutyState()
    data class Ended(val shift: ShiftInfo) : DutyState()
}

/** Minimal view of the locally tracked shift (see data/db/LocalShiftEntity). */
data class LocalShiftView(val key: String, val serverId: String?, val siteId: String, val startedAtMs: Long, val status: String) {
    companion object {
        const val PENDING_CHECK_IN = "pending_check_in"
        const val ACTIVE = "active"
        const val PENDING_CHECK_OUT = "pending_check_out"
        const val CLOSED = "closed"
        const val FAILED = "failed"
    }
}

object Duty {
    /** A shift may be started this long before its scheduled start. */
    val startWindow: Duration = Duration.ofHours(2)
    /** …and this long after (the server accepts ±6 h; the UI is stricter to avoid mistakes). */
    val lateWindow: Duration = Duration.ofHours(6)

    fun parse(ts: String?): Instant? = ts?.let { runCatching { OffsetDateTime.parse(it).toInstant() }.getOrNull() }

    fun state(shifts: List<ShiftInfo>, activeServerId: String?, local: LocalShiftView?, homeSiteId: String?, now: Instant): DutyState {
        val byId = shifts.associateBy { it.id }
        if (local != null && local.status != LocalShiftView.CLOSED && local.status != LocalShiftView.FAILED) {
            val shift = local.serverId?.let { byId[it] }
            return when (local.status) {
                LocalShiftView.PENDING_CHECK_IN -> DutyState.StartingOffline(shift, local.siteId, local.startedAtMs)
                LocalShiftView.PENDING_CHECK_OUT -> DutyState.EndingOffline(shift)
                else -> DutyState.OnDuty(shift, local.serverId, local.siteId, local.startedAtMs)
            }
        }
        val active = activeServerId?.let { byId[it] } ?: shifts.firstOrNull { it.status == "in_progress" }
        if (active != null) {
            val since = parse(active.start_captured_at ?: active.started_at)?.toEpochMilli() ?: now.toEpochMilli()
            return DutyState.OnDuty(active, active.id, active.site_id, since)
        }
        val scheduled = shifts.filter { it.status == "scheduled" }
            .mapNotNull { s -> parse(s.scheduled_start)?.let { it to s } }
            .sortedBy { (start, _) -> Duration.between(now, start).abs() }
        val next = scheduled.firstOrNull { (start, _) ->
            !start.minus(startWindow).isAfter(now) && !start.plus(lateWindow).isBefore(now)
        }
        if (next != null) return DutyState.ReadyToStart(next.second)
        val upcoming = scheduled.firstOrNull { (start, _) -> start.isAfter(now) }
        if (upcoming != null) return DutyState.Upcoming(upcoming.second)
        val ended = shifts.filter { it.status in setOf("completed", "void_location_off") }
            .maxByOrNull { parse(it.ended_at)?.toEpochMilli() ?: 0L }
        if (ended != null && parse(ended.ended_at)?.let { Duration.between(it, now) < Duration.ofHours(12) } == true) {
            return DutyState.Ended(ended)
        }
        return DutyState.NoShift(canStartAdHoc = homeSiteId != null)
    }
}
