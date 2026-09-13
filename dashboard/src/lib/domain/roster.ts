import { addDays, startOfWeek } from "date-fns";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Monday-first week containing `date`, as yyyy-MM-dd strings. */
export function weekDays(date: Date): string[] {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftWeek(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

/** Weekday index (0=Sun) of a yyyy-MM-dd string, read as a local date. */
export function weekdayOf(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

export function isPast(dateStr: string, today: string) {
  return dateStr < today;
}

/** "Mon, Tue, Wed" / "Every day" / "Weekdays" / "Weekends" for a pattern's weekday set. */
export function describeWeekdays(days: number[]) {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return "Every day";
  if (set.length === 5 && set.every((d) => d >= 1 && d <= 5)) return "Weekdays";
  if (set.length === 2 && set.includes(0) && set.includes(6)) return "Weekends";
  return set.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export type CellShift = {
  id: string;
  guard_id: string;
  status: string;
  attendance: string;
  started_at: string | null;
};

/**
 * Coverage for one roster cell: how many guards are rostered against how many the
 * shift needs, and whether anyone actually turned up.
 */
export function cellCoverage(shifts: CellShift[], required: number) {
  const filled = shifts.filter((s) => s.status !== "cancelled").length;
  const onDuty = shifts.filter((s) => s.status === "in_progress").length;
  const worked = shifts.filter((s) => s.started_at).length;
  return { filled, required, short: Math.max(0, required - filled), onDuty, worked };
}

/** A shift that has begun (or is void/absent) must not be silently unassigned. */
export function canUnassign(shift: { status: string; started_at: string | null } | undefined) {
  if (!shift) return true;
  return !shift.started_at && ["scheduled", "cancelled"].includes(shift.status);
}
