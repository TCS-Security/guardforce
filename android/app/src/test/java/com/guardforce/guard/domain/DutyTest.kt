package com.guardforce.guard.domain

import com.guardforce.guard.api.ShiftInfo
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class DutyTest {
    private val now: Instant = Instant.parse("2026-09-14T08:30:00Z") // 14:00 IST
    private fun shift(id: String, start: String, end: String, status: String = "scheduled", attendance: String = "pending", endedAt: String? = null) =
        ShiftInfo(id = id, site_id = "site-1", shift_date = "2026-09-14", scheduled_start = start, scheduled_end = end, status = status, attendance = attendance, ended_at = endedAt)

    @Test fun `no roster and a home site allows an ad-hoc start`() {
        val s = Duty.state(emptyList(), null, null, "site-1", now)
        assertIs<DutyState.NoShift>(s); assertTrue(s.canStartAdHoc)
    }

    @Test fun `a shift starting within two hours is ready`() {
        val s = Duty.state(listOf(shift("a", "2026-09-14T09:30:00Z", "2026-09-14T17:30:00Z")), null, null, "site-1", now)
        assertIs<DutyState.ReadyToStart>(s); assertEquals("a", s.shift.id)
    }

    @Test fun `a shift starting tonight is upcoming`() {
        val s = Duty.state(listOf(shift("n", "2026-09-14T16:30:00Z", "2026-09-15T00:30:00Z")), null, null, "site-1", now)
        assertIs<DutyState.Upcoming>(s)
    }

    @Test fun `server active shift wins`() {
        val active = shift("x", "2026-09-14T00:30:00Z", "2026-09-14T08:30:00Z", status = "in_progress").copy(started_at = "2026-09-14T00:35:00Z")
        val s = Duty.state(listOf(active), "x", null, "site-1", now)
        assertIs<DutyState.OnDuty>(s); assertEquals("x", s.serverShiftId)
    }

    @Test fun `queued offline check-in shows as starting`() {
        val local = LocalShiftView("loc-1", null, "site-1", now.toEpochMilli(), LocalShiftView.PENDING_CHECK_IN)
        val s = Duty.state(emptyList(), null, local, "site-1", now)
        assertIs<DutyState.StartingOffline>(s)
    }

    @Test fun `local shift resolved to a server id is on duty even before home refresh`() {
        val local = LocalShiftView("loc-1", "srv-9", "site-1", now.toEpochMilli(), LocalShiftView.ACTIVE)
        val s = Duty.state(emptyList(), null, local, "site-1", now)
        assertIs<DutyState.OnDuty>(s); assertEquals("srv-9", s.serverShiftId)
    }

    @Test fun `a shift that ended this morning is shown as ended`() {
        val done = shift("d", "2026-09-14T00:30:00Z", "2026-09-14T08:30:00Z", status = "completed", attendance = "present", endedAt = "2026-09-14T08:31:00Z")
        val s = Duty.state(listOf(done), null, null, "site-1", now)
        assertIs<DutyState.Ended>(s); assertEquals("present", s.shift.attendance)
    }

    @Test fun `closed local shift is ignored`() {
        val local = LocalShiftView("loc-1", "srv-9", "site-1", 0, LocalShiftView.CLOSED)
        val s = Duty.state(emptyList(), null, local, null, now)
        assertIs<DutyState.NoShift>(s)
    }
}
