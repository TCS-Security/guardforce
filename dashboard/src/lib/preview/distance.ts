import { rng } from "./rng";
import { addDays, type Crew, type CrewGuard } from "./crew";

/** One guard-day of movement, as the ping trail will summarise it. */
export type DistanceDay = { date: string; metres: number; outside_min: number; on_duty: boolean };

export type DistanceRow = { guard: CrewGuard; days: DistanceDay[]; total_m: number; outside_min: number };

/** The last `n` days, oldest first, ending yesterday. */
export function distanceDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n));
}

/**
 * A week of distances per guard. Static gate posts walk a few hundred metres to a
 * couple of km; roving and patrol guards cover several km a shift.
 */
export function generateDistance(crew: Crew, n = 7): DistanceRow[] {
  const dates = distanceDays(crew.today, n);
  return crew.guards
    .map((guard) => {
      const r = rng(`dist:${guard.id}:${crew.today}`);
      const roving = r.chance(0.25);
      const days = dates.map((date) => {
        const on_duty = !r.chance(1 / 7);
        const metres = on_duty ? (roving ? r.int(4500, 14000) : r.int(300, 2600)) : 0;
        const outside_min = on_duty && r.chance(0.2) ? r.int(5, 70) : 0;
        return { date, metres, outside_min, on_duty };
      });
      return { guard, days, total_m: days.reduce((n, d) => n + d.metres, 0), outside_min: days.reduce((n, d) => n + d.outside_min, 0) };
    })
    .sort((a, b) => b.total_m - a.total_m);
}

/** Sum per date across guards, oldest first. */
export function dailyTotals(rows: DistanceRow[]): { date: string; metres: number }[] {
  if (rows.length === 0) return [];
  return rows[0]!.days.map((d, i) => ({ date: d.date, metres: rows.reduce((n, r) => n + r.days[i]!.metres, 0) }));
}
