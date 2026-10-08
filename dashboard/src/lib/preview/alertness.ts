import { rng } from "./rng";
import { addDays, istInstant, type Crew, type CrewGuard } from "./crew";

/**
 * Random alertness checks: during a night shift the app rings at random moments and
 * the guard answers with a selfie. Answering late or not at all escalates to the
 * supervisor. Raksham's "sleep alerts", with a response clock and an escalation path.
 */
export type AlertnessPolicy = {
  enabled: boolean;
  checks_per_night: number;
  window_start_h: number;
  window_end_h: number;
  /** Seconds a guard has to answer before the check counts as late. */
  respond_within_s: number;
  /**
   * Seconds before the phone nudges a second time, quietly, with nobody told.
   * A guard who does not answer in the first minute is usually in the toilet, up a
   * stairwell, or stuck with a resident at the barrier — not asleep. The reminder
   * buys that back so the escalation below stays rare enough to mean something.
   */
  remind_after_s: number;
  /** Seconds after which an unanswered check is missed and the supervisor is called. */
  escalate_after_s: number;
};

export const DEFAULT_ALERTNESS_POLICY: AlertnessPolicy = {
  enabled: true,
  checks_per_night: 3,
  window_start_h: 22,
  window_end_h: 6,
  respond_within_s: 5 * 60,
  remind_after_s: 4 * 60,
  escalate_after_s: 10 * 60,
};

export type CheckStatus = "on_time" | "late" | "missed";

export type AlertCheck = {
  id: string;
  guard: CrewGuard;
  /** YYYY-MM-DD of the evening the night started. */
  night: string;
  sent_at: string;
  responded_at: string | null;
  response_s: number | null;
  status: CheckStatus;
  /** Face on the selfie matched the guard's registration photo. */
  face_match: boolean | null;
  escalated_to: string | null;
};

export function checkStatus(responseS: number | null, policy: AlertnessPolicy = DEFAULT_ALERTNESS_POLICY): CheckStatus {
  if (responseS == null || responseS > policy.escalate_after_s) return "missed";
  return responseS <= policy.respond_within_s ? "on_time" : "late";
}

const SUPERVISORS = ["Priya (supervisor)", "Arun (supervisor)"];

/** Seven nights of checks for roughly the night-shift half of the crew. */
export function generateAlertness(crew: Crew, policy: AlertnessPolicy = DEFAULT_ALERTNESS_POLICY): AlertCheck[] {
  const checks: AlertCheck[] = [];
  const nightCrew = crew.guards.filter((g) => rng(`night:${g.id}`).chance(0.55));
  const windowMin = ((policy.window_end_h + 24 - policy.window_start_h) % 24) * 60;
  for (const guard of nightCrew) {
    const r = rng(`alert:${guard.id}:${crew.today}`);
    // Most guards answer reliably; a few are habitual sleepers.
    const sleepy = r.chance(0.18);
    for (let back = 1; back <= 7; back++) {
      const night = addDays(crew.today, -back);
      if (r.chance(0.15)) continue; // weekly off
      for (let i = 0; i < policy.checks_per_night; i++) {
        const offset = r.int(0, windowMin - 1);
        const sent_at = istInstant(night, policy.window_start_h, offset);
        const roll = r.next();
        const missP = sleepy ? 0.3 : 0.04;
        const lateP = sleepy ? 0.25 : 0.08;
        const response_s = roll < missP ? null : roll < missP + lateP ? r.int(policy.respond_within_s + 20, policy.escalate_after_s) : r.int(18, policy.respond_within_s - 10);
        const status = checkStatus(response_s, policy);
        checks.push({
          id: `al-${guard.id}-${night}-${i}`,
          guard,
          night,
          sent_at,
          responded_at: response_s == null ? null : new Date(new Date(sent_at).getTime() + response_s * 1000).toISOString(),
          response_s,
          status,
          face_match: response_s == null ? null : !r.chance(0.04),
          escalated_to: status === "missed" ? r.pick(SUPERVISORS) : null,
        });
      }
    }
  }
  return checks.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
}

export type NightSummary = { night: string; on_time: number; late: number; missed: number };

/** Per-night counts, oldest first, for the trend strip. */
export function nightlySummary(checks: AlertCheck[]): NightSummary[] {
  const byNight = new Map<string, NightSummary>();
  for (const c of checks) {
    const s = byNight.get(c.night) ?? { night: c.night, on_time: 0, late: 0, missed: 0 };
    s[c.status] += 1;
    byNight.set(c.night, s);
  }
  return [...byNight.values()].sort((a, b) => a.night.localeCompare(b.night));
}

/** Guards with the most missed or late checks, worst first. */
export function repeatOffenders(checks: AlertCheck[], limit = 6) {
  const by = new Map<string, { guard: CrewGuard; missed: number; late: number; total: number }>();
  for (const c of checks) {
    const s = by.get(c.guard.id) ?? { guard: c.guard, missed: 0, late: 0, total: 0 };
    s.total += 1;
    if (c.status === "missed") s.missed += 1;
    if (c.status === "late") s.late += 1;
    by.set(c.guard.id, s);
  }
  return [...by.values()].filter((s) => s.missed + s.late > 0).sort((a, b) => b.missed - a.missed || b.late - a.late).slice(0, limit);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}
