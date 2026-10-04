import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** Column order of both roster grids: the week board reads Mon–Sun, so the month grid does too. */
export const MONDAY_FIRST_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const ROSTER_VIEWS = ["week", "month"] as const;
export type RosterView = (typeof ROSTER_VIEWS)[number];

/** The `view` query param, defaulting to the week board. */
export function parseRosterView(value: unknown): RosterView {
  return value === "month" ? "month" : "week";
}

/**
 * Noon on a yyyy-MM-dd, read as a local date. Midnight would let a UTC offset or a
 * DST jump roll the anchor onto the day before; noon never does. Every anchor in
 * this module is built this way so `isoDate(anchor(s)) === s` always holds.
 */
export function dayAnchor(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`);
}

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

/** Noon on the 1st of the month containing `date`. */
export function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

/** Every day of the calendar month containing `date`. */
export function monthDays(date: Date): string[] {
  const first = monthStart(date);
  const length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length }, (_, i) => isoDate(addDays(first, i)));
}

/**
 * The month containing `date` as a Monday-first calendar grid: whole weeks, padded
 * with the tail of the previous month and the head of the next one so the grid is
 * always a multiple of 7 (35 or 42 cells).
 */
export function monthGridDays(date: Date): string[] {
  const first = monthStart(date);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const start = addDays(first, -lead);
  const length = Math.ceil((lead + monthDays(date).length) / 7) * 7;
  return Array.from({ length }, (_, i) => isoDate(addDays(start, i)));
}

/**
 * The same calendar day `months` later/earlier, without date-fns' end-of-month
 * clamping: stepping from 31 Jan lands on 1 Feb, not 28 Feb, so paging forward and
 * back returns you to where you started.
 */
export function shiftMonth(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

/** "2026-09" for the month containing `date`. */
export function monthKey(date: Date) {
  return isoDate(monthStart(date)).slice(0, 7);
}

export function isInMonth(dateStr: string, date: Date) {
  return dateStr.slice(0, 7) === monthKey(date);
}

export function monthLabel(date: Date) {
  return format(monthStart(date), "MMMM yyyy");
}

/** The days a view shows for an anchor date — the grid, and the range we query. */
export function rosterDays(date: Date, view: RosterView): string[] {
  return view === "month" ? monthGridDays(date) : weekDays(date);
}

/** One step of the active unit: the arrows page by week or by month. */
export function stepAnchor(date: Date, view: RosterView, delta: number) {
  return view === "month" ? shiftMonth(date, delta) : shiftWeek(date, delta);
}

/** Inclusive day count of a yyyy-MM-dd range. */
export function rangeSpanDays(from: string, to: string) {
  return differenceInCalendarDays(dayAnchor(to), dayAnchor(from)) + 1;
}

/** "14–20 Sep 2026" / "29 Sep – 5 Oct 2026" / "28 Dec 2026 – 3 Jan 2027". */
export function rangeLabel(from: string, to: string) {
  const a = dayAnchor(from);
  const b = dayAnchor(to);
  if (from === to) return format(a, "d MMM yyyy");
  if (from.slice(0, 7) === to.slice(0, 7)) return `${format(a, "d")}–${format(b, "d MMM yyyy")}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${format(a, "d MMM")} – ${format(b, "d MMM yyyy")}`;
  return `${format(a, "d MMM yyyy")} – ${format(b, "d MMM yyyy")}`;
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

/**
 * Turns the database's own wording for a failed assignment into something an
 * operator can act on.
 *
 * `KYC_INCOMPLETE` comes from the trigger 0014 drops, so on an up-to-date database
 * that branch never fires. It is kept because migrations only run on `main`: any
 * environment whose schema is behind its code — a Vercel preview, most obviously —
 * still has the old rule, and "the Assign button does nothing useful" is a far worse
 * way to discover that than being told.
 */
export function rosterErrorMessage(message: string) {
  if (message.includes("KYC_INCOMPLETE")) {
    return "This database still enforces the old rule that a guard with incomplete KYC cannot be rostered. The migration that withdraws it has not been applied here yet.";
  }
  if (message.includes("duplicate key")) return "That guard is already on this shift for the day.";
  return message;
}
