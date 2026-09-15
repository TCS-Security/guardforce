import type { ShiftInfo } from "../api/types";

export type LocalShift = { key: string; serverId: string | null; siteId: string; startedAtMs: number; status: LocalStatus };
export type LocalStatus = "pending_check_in" | "active" | "pending_check_out" | "closed" | "failed";

export type DutyState =
  | { kind: "no_shift"; canStartAdHoc: boolean }
  | { kind: "upcoming"; shift: ShiftInfo }
  | { kind: "ready"; shift: ShiftInfo }
  | { kind: "starting_offline"; shift: ShiftInfo | null; siteId: string; sinceMs: number }
  | { kind: "on_duty"; shift: ShiftInfo | null; serverShiftId: string | null; siteId: string; sinceMs: number }
  | { kind: "ending_offline"; shift: ShiftInfo | null }
  | { kind: "ended"; shift: ShiftInfo };

const H = 3_600_000;
export const startWindowMs = 2 * H; // may start this long before scheduled_start
export const lateWindowMs = 6 * H; // …and this long after
const parse = (s?: string | null) => (s ? Date.parse(s) : NaN);

/** What the home card shows: server state overlaid with what this phone has queued. */
export function dutyState(shifts: ShiftInfo[], activeServerId: string | null | undefined, local: LocalShift | null, homeSiteId: string | null | undefined, nowMs: number): DutyState {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  if (local && local.status !== "closed" && local.status !== "failed") {
    const shift = local.serverId ? byId.get(local.serverId) ?? null : null;
    if (local.status === "pending_check_in") return { kind: "starting_offline", shift, siteId: local.siteId, sinceMs: local.startedAtMs };
    if (local.status === "pending_check_out") return { kind: "ending_offline", shift };
    return { kind: "on_duty", shift, serverShiftId: local.serverId, siteId: local.siteId, sinceMs: local.startedAtMs };
  }
  const active = (activeServerId && byId.get(activeServerId)) || shifts.find((s) => s.status === "in_progress");
  if (active) {
    const since = parse(active.start_captured_at ?? active.started_at);
    return { kind: "on_duty", shift: active, serverShiftId: active.id, siteId: active.site_id, sinceMs: Number.isNaN(since) ? nowMs : since };
  }
  const scheduled = shifts.filter((s) => s.status === "scheduled" && !Number.isNaN(parse(s.scheduled_start)))
    .sort((a, b) => Math.abs(parse(a.scheduled_start) - nowMs) - Math.abs(parse(b.scheduled_start) - nowMs));
  const ready = scheduled.find((s) => { const st = parse(s.scheduled_start); return st - startWindowMs <= nowMs && st + lateWindowMs >= nowMs; });
  if (ready) return { kind: "ready", shift: ready };
  const upcoming = scheduled.find((s) => parse(s.scheduled_start) > nowMs);
  if (upcoming) return { kind: "upcoming", shift: upcoming };
  const ended = shifts.filter((s) => s.status === "completed" || s.status === "void_location_off")
    .sort((a, b) => (parse(b.ended_at) || 0) - (parse(a.ended_at) || 0))[0];
  if (ended && nowMs - (parse(ended.ended_at) || 0) < 12 * H) return { kind: "ended", shift: ended };
  return { kind: "no_shift", canStartAdHoc: !!homeSiteId };
}
