import type { Shift } from "@/lib/supabase/types";

/**
 * Client-side mirror of public.compute_attendance for previews and tests.
 * present  : worked >= halfDayRatio of scheduled
 * half_day : worked > 0 but below the ratio
 * absent   : nothing worked, or shift void
 */
export function deriveAttendance(
  s: Pick<Shift, "status" | "started_at" | "scheduled_start" | "scheduled_end" | "worked_minutes" | "override_attendance">,
  opts: { halfDayRatio?: number; onLeave?: boolean } = {},
) {
  const ratio = opts.halfDayRatio ?? 0.5;
  if (s.override_attendance) return s.override_attendance;
  if (opts.onLeave && !s.started_at) return "on_leave" as const;
  if (s.status === "void_location_off") return "absent" as const;
  if (!s.started_at) return s.status === "absent" ? ("absent" as const) : ("pending" as const);
  const sched = s.scheduled_start && s.scheduled_end
    ? Math.max(1, (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 60000)
    : Math.max(1, s.worked_minutes);
  const r = s.worked_minutes / sched;
  if (r >= ratio) return "present" as const;
  return s.worked_minutes > 0 ? ("half_day" as const) : ("absent" as const);
}

/** Trust badge mirror of public.compute_trust. */
export function deriveTrust(flags: string[], accuracyM?: number | null, batteryPct?: number | null, isMock = false) {
  if (isMock || flags.includes("TAMPER_SUSPECTED") || flags.includes("LOCATION_OFF")) return "suspicious" as const;
  if (flags.includes("OUTSIDE_FENCE") || (accuracyM ?? 0) > 50 || (batteryPct ?? 100) < 10 || flags.includes("SYNCED_LATE")) return "flagged" as const;
  return "clean" as const;
}

export function lateMinutes(scheduledStart: string | null, startedAt: string | null, thresholdMin = 15) {
  if (!scheduledStart || !startedAt) return { late: 0, isLate: false };
  const late = Math.max(0, Math.floor((new Date(startedAt).getTime() - new Date(scheduledStart).getTime()) / 60000));
  return { late, isLate: late > thresholdMin };
}

/** Punctuality % = shifts started on time / shifts started. */
export function punctuality(shifts: Pick<Shift, "started_at" | "flags">[]) {
  const started = shifts.filter((s) => s.started_at);
  if (started.length === 0) return null;
  const onTime = started.filter((s) => !s.flags.includes("LATE_START")).length;
  return (100 * onTime) / started.length;
}
