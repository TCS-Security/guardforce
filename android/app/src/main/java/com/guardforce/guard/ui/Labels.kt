package com.guardforce.guard.ui

import android.content.Context
import com.guardforce.guard.R
import com.guardforce.guard.core.AppError
import com.guardforce.guard.domain.TimeText
import com.guardforce.guard.ui.components.Tone

/** Status → label/tone, mirroring dashboard/src/lib/domain/status.ts. */
object Labels {
    fun attendance(ctx: Context, a: String): Pair<String, Tone> = when (a) {
        "present" -> ctx.getString(R.string.attendance_present) to Tone.Present
        "half_day" -> ctx.getString(R.string.attendance_half_day) to Tone.HalfDay
        "absent" -> ctx.getString(R.string.attendance_absent) to Tone.Absent
        "on_leave" -> ctx.getString(R.string.attendance_on_leave) to Tone.OnLeave
        else -> ctx.getString(R.string.attendance_pending) to Tone.Neutral
    }

    fun flag(ctx: Context, f: String): String = when (f) {
        "OUTSIDE_FENCE" -> ctx.getString(R.string.flag_outside_fence)
        "LATE_START" -> ctx.getString(R.string.flag_late_start)
        "EARLY_CHECKOUT" -> ctx.getString(R.string.flag_early_checkout)
        "LOCATION_OFF" -> ctx.getString(R.string.flag_location_off)
        "TAMPER_SUSPECTED" -> ctx.getString(R.string.flag_tamper)
        "SYNCED_LATE" -> ctx.getString(R.string.flag_synced_late)
        "LOW_ACCURACY" -> ctx.getString(R.string.flag_low_accuracy)
        else -> f
    }

    fun patrol(ctx: Context, s: String): Pair<String, Tone> = when (s) {
        "in_progress" -> ctx.getString(R.string.patrol_status_in_progress) to Tone.Olive
        "completed" -> ctx.getString(R.string.patrol_status_completed) to Tone.Present
        "late" -> ctx.getString(R.string.patrol_status_late) to Tone.HalfDay
        "missed" -> ctx.getString(R.string.patrol_status_missed) to Tone.Absent
        else -> ctx.getString(R.string.patrol_status_scheduled) to Tone.Neutral
    }

    fun leave(ctx: Context, s: String): Pair<String, Tone> = when (s) {
        "approved" -> ctx.getString(R.string.leave_status_approved) to Tone.Present
        "declined" -> ctx.getString(R.string.leave_status_declined) to Tone.Absent
        "cancelled" -> ctx.getString(R.string.leave_status_cancelled) to Tone.Neutral
        else -> ctx.getString(R.string.leave_status_pending) to Tone.HalfDay
    }

    fun leaveType(ctx: Context, t: String): String = when (t) {
        "earned" -> ctx.getString(R.string.leave_earned)
        "unpaid" -> ctx.getString(R.string.leave_unpaid)
        else -> ctx.getString(R.string.leave_casual)
    }

    fun docType(ctx: Context, t: String): String = when (t) {
        "aadhaar" -> ctx.getString(R.string.doc_aadhaar); "pan" -> ctx.getString(R.string.doc_pan)
        "police_verification" -> ctx.getString(R.string.doc_police_verification); "marksheet" -> ctx.getString(R.string.doc_marksheet)
        "guard_kyc" -> ctx.getString(R.string.doc_guard_kyc); else -> ctx.getString(R.string.doc_other)
    }

    fun docStatus(ctx: Context, s: String?): Pair<String, Tone> = when (s) {
        "verified" -> ctx.getString(R.string.doc_verified) to Tone.Present
        "rejected" -> ctx.getString(R.string.doc_rejected) to Tone.Absent
        "pending" -> ctx.getString(R.string.doc_pending) to Tone.HalfDay
        else -> ctx.getString(R.string.doc_missing) to Tone.Neutral
    }

    fun kycGap(ctx: Context, g: String): String = when (g) {
        "phone_verification" -> ctx.getString(R.string.gap_phone_verification)
        "registration_selfie" -> ctx.getString(R.string.gap_registration_selfie)
        "designation" -> ctx.getString(R.string.gap_designation)
        else -> docType(ctx, g)
    }

    fun relative(ctx: Context, r: TimeText.Relative): String = when (r) {
        TimeText.Relative.Now -> ctx.getString(R.string.time_now)
        is TimeText.Relative.Minutes -> ctx.getString(R.string.time_min_ago, r.n)
        is TimeText.Relative.Hours -> ctx.getString(R.string.time_hr_ago, r.n)
    }

    fun duration(ctx: Context, seconds: Long): String {
        val h = seconds / 3600; val m = (seconds % 3600) / 60
        return if (h > 0) ctx.getString(R.string.duration_hm, h.toInt(), m.toInt()) else ctx.getString(R.string.duration_m, m.toInt())
    }

    fun error(ctx: Context, e: Throwable): String = when (e) {
        is AppError.Network -> ctx.getString(R.string.error_network)
        is AppError.Unauthorized -> ctx.getString(R.string.error_session)
        is AppError.Rpc -> when (e.code) {
            "NO_GUARD_FOR_PHONE" -> ctx.getString(R.string.claim_not_found)
            "PHONE_ALREADY_LINKED" -> ctx.getString(R.string.claim_already_linked)
            "TAMPER_SUSPECTED" -> ctx.getString(R.string.checkin_mock)
            "LEAVE_OVERLAP" -> ctx.getString(R.string.leave_overlap)
            "LEAVE_DATES_INVALID" -> ctx.getString(R.string.leave_dates_invalid)
            "PATROL_PHOTO_REQUIRED" -> ctx.getString(R.string.patrol_photo_required, 1)
            "TASK_PHOTO_REQUIRED" -> ctx.getString(R.string.task_photo_required)
            else -> ctx.getString(R.string.error_generic, e.code)
        }
        is AppError.Http -> if (e.status in 400..499 && e.detail.contains("otp", true) || e.detail.contains("token", true)) ctx.getString(R.string.otp_invalid) else ctx.getString(R.string.error_generic, e.detail.take(80))
        else -> ctx.getString(R.string.error_generic, e.message?.take(80) ?: "?")
    }
}
