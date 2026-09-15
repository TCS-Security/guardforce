import type { ShiftInfo } from "../api/types";
import { dutyState } from "../domain/duty";

const now = Date.parse("2026-09-14T08:30:00Z"); // 14:00 IST
const shift = (id: string, start: string, end: string, extra: Partial<ShiftInfo> = {}): ShiftInfo => ({
  id, site_id: "site-1", shift_date: "2026-09-14", scheduled_start: start, scheduled_end: end, status: "scheduled", attendance: "pending",
  flags: [], late_by_min: 0, worked_minutes: 0, away_seconds: 0, location_enabled: true, location_off_seconds: 0, has_exception: false, ...extra,
});

test("no roster and a home site allows an ad-hoc start", () => {
  expect(dutyState([], null, null, "site-1", now)).toEqual({ kind: "no_shift", canStartAdHoc: true });
});
test("a shift starting within two hours is ready; tonight's is upcoming", () => {
  expect(dutyState([shift("a", "2026-09-14T09:30:00Z", "2026-09-14T17:30:00Z")], null, null, "site-1", now).kind).toBe("ready");
  expect(dutyState([shift("n", "2026-09-14T16:30:00Z", "2026-09-15T00:30:00Z")], null, null, "site-1", now).kind).toBe("upcoming");
});
test("the server's active shift wins", () => {
  const active = shift("x", "2026-09-14T00:30:00Z", "2026-09-14T08:30:00Z", { status: "in_progress", started_at: "2026-09-14T00:35:00Z" });
  const s = dutyState([active], "x", null, "site-1", now);
  expect(s.kind).toBe("on_duty"); if (s.kind === "on_duty") expect(s.serverShiftId).toBe("x");
});
test("queued offline check-in shows as starting; resolved local shift is on duty", () => {
  expect(dutyState([], null, { key: "l", serverId: null, siteId: "site-1", startedAtMs: now, status: "pending_check_in" }, "site-1", now).kind).toBe("starting_offline");
  const s = dutyState([], null, { key: "l", serverId: "srv-9", siteId: "site-1", startedAtMs: now, status: "active" }, "site-1", now);
  expect(s.kind).toBe("on_duty"); if (s.kind === "on_duty") expect(s.serverShiftId).toBe("srv-9");
});
test("a shift that ended this morning is shown as ended; closed local shifts are ignored", () => {
  const done = shift("d", "2026-09-14T00:30:00Z", "2026-09-14T08:30:00Z", { status: "completed", attendance: "present", ended_at: "2026-09-14T08:31:00Z" });
  expect(dutyState([done], null, null, "site-1", now).kind).toBe("ended");
  expect(dutyState([], null, { key: "l", serverId: "s", siteId: "site-1", startedAtMs: 0, status: "closed" }, null, now)).toEqual({ kind: "no_shift", canStartAdHoc: false });
});
