import { format } from "date-fns";
import type { LeaveBalance, LeaveType } from "@/lib/supabase/types";

/** Column defaults from the schema (leave_balances). */
export const BALANCE_DEFAULTS = { casual_total: 12, earned_total: 15 } as const;

/** Calendar marks a day "thin cover" when this many guards are on approved leave at the site. */
export const THIN_COVER_THRESHOLD = 2;

/* ---------------------------------------------------------------------------
 * Dates are plain ISO day strings ("2026-09-16"); they compare lexicographically.
 * ------------------------------------------------------------------------- */

/** Inclusive day count between two ISO dates — mirrors decide_leave (end − start + 1). */
export function leaveDays(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

/** Whether two inclusive date ranges share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const f = (s: string, pattern: string) => format(utc(s), pattern, { timeZone: "UTC" });

/** "16 Sep 2026" · "16–17 Sep 2026" · "30 Sep – 2 Oct 2026" · "30 Dec 2026 – 2 Jan 2027" */
export function fmtLeaveRange(start: string, end: string): string {
  if (start === end) return f(start, "d MMM yyyy");
  const sy = +start.slice(0, 4), sm = +start.slice(5, 7);
  const ey = +end.slice(0, 4), em = +end.slice(5, 7);
  if (sy === ey && sm === em) return `${f(start, "d")}–${f(end, "d MMM yyyy")}`;
  if (sy === ey) return `${f(start, "d MMM")} – ${f(end, "d MMM yyyy")}`;
  return `${f(start, "d MMM yyyy")} – ${f(end, "d MMM yyyy")}`;
}

/* ---------------------------------------------------------------------------
 * Balances (F8)
 * ------------------------------------------------------------------------- */

/**
 * Days of the given type still available this year. Unpaid leave has no cap
 * (only a used counter), so it returns null. Guards without a balance row get
 * the schema defaults with zero used.
 */
export function balanceRemaining(
  balance: Pick<LeaveBalance, "casual_total" | "casual_used" | "earned_total" | "earned_used"> | null | undefined,
  type: LeaveType,
): number | null {
  if (type === "unpaid") return null;
  if (!balance) {
    return type === "casual" ? BALANCE_DEFAULTS.casual_total : BALANCE_DEFAULTS.earned_total;
  }
  return type === "casual" ? balance.casual_total - balance.casual_used : balance.earned_total - balance.earned_used;
}

/* ---------------------------------------------------------------------------
 * Staffing impact (F8): who else is already out at the same site
 * ------------------------------------------------------------------------- */

export type ApprovedLeaveLite = {
  guard_id: string;
  site_id: string | null;
  start_date: string;
  end_date: string;
  full_name: string;
};

export type StaffingImpact = { count: number; names: string[]; maxPerDay: number };

function nextDay(iso: string): string {
  return format(new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000), "yyyy-MM-dd", { timeZone: "UTC" });
}

/**
 * For a (pending) request: other guards already on approved leave at the same
 * site during its dates. `count` = distinct guards, `names` = their names,
 * `maxPerDay` = worst day concurrency *including* this request (used for the
 * thin-cover marker; ≥ THIN_COVER_THRESHOLD means the site runs thin).
 */
export function staffingImpact(
  req: { guard_id: string; site_id: string | null; start_date: string; end_date: string },
  approved: ApprovedLeaveLite[],
): StaffingImpact {
  if (!req.site_id) return { count: 0, names: [], maxPerDay: 0 };
  const others = new Map<string, string>();
  let maxPerDay = 1;
  for (const o of approved) {
    if (!o.site_id || o.site_id !== req.site_id || o.guard_id === req.guard_id) continue;
    if (rangesOverlap(req.start_date, req.end_date, o.start_date, o.end_date)) others.set(o.guard_id, o.full_name);
  }
  for (let d = req.start_date; d <= req.end_date; d = nextDay(d)) {
    let dayCount = 0;
    for (const o of approved) {
      if (!o.site_id || o.site_id !== req.site_id || o.guard_id === req.guard_id) continue;
      if (o.start_date <= d && d <= o.end_date) dayCount++;
    }
    maxPerDay = Math.max(maxPerDay, dayCount + 1);
  }
  return { count: others.size, names: [...others.values()], maxPerDay };
}

/* ---------------------------------------------------------------------------
 * Month grid (Sunday-first) for the leave calendar
 * ------------------------------------------------------------------------- */

export type MonthCell = { date: string; inMonth: boolean };

/** All days of the month, padded to complete Sunday–Saturday weeks. */
export function monthGrid(year: number, month: number): MonthCell[] {
  if (month < 1 || month > 12) return [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(Date.UTC(year, month - 1, 1 - first.getUTCDay()));
  const last = new Date(Date.UTC(year, month, 0));
  const end = new Date(Date.UTC(year, month - 1, last.getUTCDate() + (6 - last.getUTCDay())));
  const cells: MonthCell[] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    cells.push({ date: format(d, "yyyy-MM-dd", { timeZone: "UTC" }), inMonth: d.getUTCMonth() === month - 1 });
  }
  return cells;
}

/** "YYYY-MM" bounds as ISO dates covering the padded grid (for DB range queries). */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const grid = monthGrid(year, month);
  if (grid.length === 0) return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: `${year}-${String(month).padStart(2, "0")}-28` };
  return { from: grid[0]!.date, to: grid[grid.length - 1]!.date };
}

/** Parse and validate a "YYYY-MM" param; null when malformed. */
export function parseMonthParam(value: string | undefined): { year: number; month: number } | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return { year: +value.slice(0, 4), month: +value.slice(5, 7) };
}

/** Neighboring month as "YYYY-MM" (delta −1/+1). */
export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return format(d, "yyyy-MM", { timeZone: "UTC" });
}

/** "September 2026" */
export function monthLabel(year: number, month: number): string {
  return format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy", { timeZone: "UTC" });
}
