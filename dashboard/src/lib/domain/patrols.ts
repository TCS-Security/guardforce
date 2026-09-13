import type { PatrolStatus } from "@/lib/supabase/types";

export type PatrolTally = Record<PatrolStatus, number>;

export function emptyTally(): PatrolTally {
  return { scheduled: 0, in_progress: 0, completed: 0, late: 0, missed: 0 };
}

export function tallyPatrols(patrols: { status: PatrolStatus }[]): PatrolTally {
  const t = emptyTally();
  for (const p of patrols) t[p.status] += 1;
  return t;
}

/**
 * Patrol compliance (PAT-1): of the rounds that were actually due, how many were walked
 * on time. Rounds still pending are not counted for or against — they have not happened
 * yet, and counting them would make every morning look like a failure.
 */
export function compliancePct(t: PatrolTally): number | null {
  const due = t.completed + t.late + t.missed;
  if (due === 0) return null;
  return Math.round((100 * t.completed) / due);
}

export function dueCount(t: PatrolTally) {
  return t.completed + t.late + t.missed;
}

/** Compliance below this reads as a problem worth surfacing (PRD success metric: 85%). */
export const COMPLIANCE_TARGET = 85;

export function complianceTone(pct: number | null): "present" | "half-day" | "absent" | "neutral" {
  if (pct == null) return "neutral";
  if (pct >= COMPLIANCE_TARGET) return "present";
  if (pct >= 60) return "half-day";
  return "absent";
}

/** How late a round started against its expected time, in minutes (0 when on time). */
export function latenessMin(expectedAt: string | null, startedAt: string | null) {
  if (!expectedAt || !startedAt) return 0;
  return Math.max(0, Math.round((new Date(startedAt).getTime() - new Date(expectedAt).getTime()) / 60000));
}

/** A round is overdue once it is past its expected time plus twice the route's grace. */
export function isOverdue(expectedAt: string | null, graceMin: number, now = new Date()) {
  if (!expectedAt) return false;
  return now.getTime() > new Date(expectedAt).getTime() + graceMin * 2 * 60_000;
}
