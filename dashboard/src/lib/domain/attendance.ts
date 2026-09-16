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

// ---------------------------------------------------------------------------
// Day-view filters (?status= / ?trust= on /attendance)
// ---------------------------------------------------------------------------

/**
 * `status` mixes two columns on purpose: the owner thinks of "on duty now" and
 * "absent" as one list of states, but `on_duty` lives on `shifts.status` while the
 * rest live on `shifts.attendance`. `worked` and `any_flag` exist so the overview
 * tiles can link to exactly the set of guards they counted.
 */
export const ATTENDANCE_STATUS_FILTERS = [
  { value: "all", label: "Any status" },
  { value: "on_duty", label: "On duty now" },
  { value: "worked", label: "Present or half day" },
  { value: "present", label: "Present (full day)" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "on_leave", label: "On leave" },
  { value: "pending", label: "Not started yet" },
] as const;

export const TRUST_FILTERS = [
  { value: "all", label: "Any trust" },
  { value: "any_flag", label: "Flagged or suspicious" },
  { value: "clean", label: "Clean" },
  { value: "flagged", label: "Flagged" },
  { value: "suspicious", label: "Suspicious" },
] as const;

export type AttendanceStatusFilter = (typeof ATTENDANCE_STATUS_FILTERS)[number]["value"];
export type TrustFilter = (typeof TRUST_FILTERS)[number]["value"];

export type AttendanceColumnFilters = {
  /** values for `shifts.attendance`, or null for "don't filter" */
  attendance: string[] | null;
  /** values for `shifts.status` */
  shiftStatus: string[] | null;
  /** values for `shifts.trust` */
  trust: string[] | null;
};

const STATUS_TO_COLUMNS: Record<string, Pick<AttendanceColumnFilters, "attendance" | "shiftStatus">> = {
  on_duty: { attendance: null, shiftStatus: ["in_progress"] },
  worked: { attendance: ["present", "half_day"], shiftStatus: null },
  present: { attendance: ["present"], shiftStatus: null },
  half_day: { attendance: ["half_day"], shiftStatus: null },
  absent: { attendance: ["absent"], shiftStatus: null },
  on_leave: { attendance: ["on_leave"], shiftStatus: null },
  pending: { attendance: ["pending"], shiftStatus: null },
};

const TRUST_TO_COLUMN: Record<string, string[]> = {
  // site_day_summary counts "flagged" as trust in (flagged, suspicious) — match it.
  any_flag: ["flagged", "suspicious"],
  clean: ["clean"],
  flagged: ["flagged"],
  suspicious: ["suspicious"],
};

/** Resolve the `?status=`/`?trust=` params into the columns the query filters on. Unknown values are ignored. */
export function attendanceColumnFilters(status: string | null, trust: string | null): AttendanceColumnFilters {
  const s = (status && STATUS_TO_COLUMNS[status]) || { attendance: null, shiftStatus: null };
  return { attendance: s.attendance, shiftStatus: s.shiftStatus, trust: (trust && TRUST_TO_COLUMN[trust]) || null };
}

/** The value a <Select> should show — unknown/absent params fall back to "all". */
export function normalizeStatusFilter(value: string | null): AttendanceStatusFilter {
  return value && value in STATUS_TO_COLUMNS ? (value as AttendanceStatusFilter) : "all";
}

export function normalizeTrustFilter(value: string | null): TrustFilter {
  return value && value in TRUST_TO_COLUMN ? (value as TrustFilter) : "all";
}
