import { rng } from "./rng";
import { addDays, istInstant, type Crew, type CrewGuard } from "./crew";

export type OtStatus = "pending" | "approved" | "declined";

export type OtEntry = {
  id: string;
  guard: CrewGuard;
  date: string;
  /** Rostered end of the shift. */
  scheduled_end: string;
  /** When the guard actually checked out. */
  actual_end: string;
  minutes: number;
  reason: string | null;
  status: OtStatus;
  /** Set on entries that need a second look: no reason given, or the guard is over the weekly cap. */
  flag: "no_reason" | "over_cap" | null;
};

export type OtPolicy = {
  /** Ordinary hours in a week before overtime is due. */
  weekly_regular_h: number;
  /** Hard ceiling on overtime in a week; past it, entries are flagged. */
  weekly_ot_cap_h: number;
  /** Overtime pays this multiple of the ordinary hourly rate. */
  multiplier: number;
  /** Extra minutes below this are rounding, not overtime. */
  grace_min: number;
};

export const DEFAULT_OT_POLICY: OtPolicy = { weekly_regular_h: 48, weekly_ot_cap_h: 12, multiplier: 2, grace_min: 15 };

const REASONS = [
  "Relief guard late",
  "Relief guard absent, held over",
  "Client asked for extra cover",
  "Incident report after shift",
  "Truck unloading ran late",
  "VIP visit at gate",
];

/** Minutes past the grace window that count as overtime; 0 inside it. */
export function overtimeMinutes(scheduledEnd: string, actualEnd: string, graceMin = DEFAULT_OT_POLICY.grace_min): number {
  const over = Math.round((new Date(actualEnd).getTime() - new Date(scheduledEnd).getTime()) / 60000);
  return over > graceMin ? over : 0;
}

/** OT pay for some minutes at a monthly wage, the way payroll computes it (8-hour day, 26 days). */
export function overtimePay(minutes: number, monthlyWage: number, policy: OtPolicy = DEFAULT_OT_POLICY): number {
  const hourly = monthlyWage / 26 / 8;
  return Math.round((minutes / 60) * hourly * policy.multiplier);
}

/** Two weeks of sample overtime, ending yesterday (today's shifts may not have ended): the last two days pending, the rest decided. */
export function generateOvertime(crew: Crew, policy: OtPolicy = DEFAULT_OT_POLICY): OtEntry[] {
  const entries: OtEntry[] = [];
  for (const guard of crew.guards) {
    const r = rng(`ot:${guard.id}:${crew.today}`);
    // A handful of guards carry most of the overtime, as in real rosters.
    const heavy = r.chance(0.2);
    for (let back = 1; back <= 14; back++) {
      if (!r.chance(heavy ? 0.65 : 0.12)) continue;
      const date = addDays(crew.today, -back);
      const night = r.chance(0.4);
      const scheduled_end = night ? istInstant(addDays(date, 1), 8) : istInstant(date, 20);
      const extra = heavy ? r.int(60, 240) : r.int(20, 120);
      const actual_end = new Date(new Date(scheduled_end).getTime() + extra * 60000).toISOString();
      const minutes = overtimeMinutes(scheduled_end, actual_end, policy.grace_min);
      if (minutes === 0) continue;
      const reason = r.chance(0.82) ? r.pick(REASONS) : null;
      const status: OtStatus = back <= 2 ? "pending" : r.chance(0.88) ? "approved" : "declined";
      entries.push({ id: `ot-${guard.id}-${date}`, guard, date, scheduled_end, actual_end, minutes, reason, status, flag: null });
    }
  }
  const weekly = weeklyOvertime(entries, crew.today);
  for (const e of entries) {
    if (!e.reason) e.flag = "no_reason";
    else if ((weekly.get(e.guard.id) ?? 0) > policy.weekly_ot_cap_h * 60) e.flag = "over_cap";
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.guard.full_name.localeCompare(b.guard.full_name));
}

/** Overtime minutes per guard over the 7 days ending `today`, declined entries excluded. */
export function weeklyOvertime(entries: OtEntry[], today: string): Map<string, number> {
  const from = addDays(today, -6);
  const out = new Map<string, number>();
  for (const e of entries) {
    if (e.status === "declined" || e.date < from || e.date > today) continue;
    out.set(e.guard.id, (out.get(e.guard.id) ?? 0) + e.minutes);
  }
  return out;
}
