import { describe, expect, it } from "vitest";
import {
  ALERT_FEED_LIMIT,
  alertDetail,
  alertEventHref,
  alertGroupKey,
  alertGroupMode,
  alertRouteName,
  groupAlerts,
  mergeAlert,
  type AlertEvent,
} from "@/lib/domain/alerts";

const GUARD = "e0000000-0000-4000-8000-000000000003";
const GUARD2 = "e0000000-0000-4000-8000-000000000004";
const SITE = "c0000000-0000-4000-8000-000000000001";

let seq = 0;
function ev(over: Partial<AlertEvent> = {}): AlertEvent {
  seq += 1;
  return {
    id: `ev-${String(seq).padStart(3, "0")}`,
    type: "PATROL_MISSED",
    severity: "warn",
    title: "Mohan Lal missed patrol Perimeter round",
    payload: {},
    created_at: "2026-09-14T16:20:04.694Z",
    site_id: SITE,
    guard_id: GUARD,
    shift_id: null,
    acknowledged_at: null,
    sites: { name: "Prestige Tech Park — Gate 3" },
    guards: { full_name: "Mohan Lal" },
    ...over,
  };
}

/** The exact shape `run_monitors` writes for a missed round. */
function missedRound(hhmm: string, over: Partial<AlertEvent> = {}) {
  return ev({
    payload: { patrol_id: `p-${hhmm}`, route_id: "route-perimeter", route_name: "Perimeter round", body: `Expected ${hhmm}` },
    created_at: `2026-09-14T${hhmm}:00.000Z`,
    ...over,
  });
}

describe("alertGroupMode", () => {
  it("groups a missed patrol by guard and route, an outage by guard, a late start by shift", () => {
    expect(alertGroupMode("PATROL_MISSED")).toBe("guard_route");
    expect(alertGroupMode("OUTAGE")).toBe("guard");
    expect(alertGroupMode("LATE_START")).toBe("shift");
  });

  it("leaves everything else ungrouped", () => {
    expect(alertGroupMode("STAFFING_GAP")).toBe("none");
    expect(alertGroupMode("EXCEPTION_LOGGED")).toBe("none");
  });
});

describe("alertRouteName", () => {
  it("prefers the payload the monitor writes", () => {
    expect(alertRouteName(missedRound("14:34"))).toBe("Perimeter round");
  });

  it("falls back to the title for events written before the payload carried the route", () => {
    expect(alertRouteName(ev({ payload: { patrol_id: "legacy" } }))).toBe("Perimeter round");
  });

  it("does not mistake 'patrol started late' for a route name", () => {
    expect(alertRouteName(ev({ type: "PATROL_LATE", title: "Mohan Lal: patrol started late" }))).toBeNull();
  });
});

describe("alertDetail", () => {
  it("surfaces the distinguishing body line", () => {
    expect(alertDetail(missedRound("12:34"))).toBe("Expected 12:34");
  });

  it("derives a detail from structured payload fields when there is no body", () => {
    expect(alertDetail(ev({ type: "FENCE_EXIT", payload: { distance_m: 380 } }))).toBe("380 m from the fence");
    expect(alertDetail(ev({ payload: {} }))).toBeNull();
  });
});

describe("groupAlerts", () => {
  it("collapses repeats of the same round for one guard into a single row", () => {
    const groups = groupAlerts([missedRound("20:04"), missedRound("18:04"), missedRound("17:04")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(3);
    expect(groups[0]!.events).toHaveLength(3);
  });

  it("carries the count and the latest timestamp", () => {
    const groups = groupAlerts([missedRound("17:04"), missedRound("20:04"), missedRound("18:04")]);
    expect(groups[0]!.count).toBe(3);
    expect(groups[0]!.latest.created_at).toBe("2026-09-14T20:04:00.000Z");
    expect(groups[0]!.detail).toBe("Expected 20:04");
    expect(groups[0]!.headline).toBe("Mohan Lal missed 3 patrol rounds on Perimeter round");
    // newest first, so the expanded list reads top-down
    expect(groups[0]!.events.map((e) => alertDetail(e))).toEqual(["Expected 20:04", "Expected 18:04", "Expected 17:04"]);
  });

  it("keeps a single event's own title and links straight at it", () => {
    const one = groupAlerts([missedRound("20:04", { shift_id: "shift-1" })])[0]!;
    expect(one.count).toBe(1);
    expect(one.headline).toBe("Mohan Lal missed patrol Perimeter round");
    expect(one.href).toBe("/attendance/shift-1");
  });

  it("points a grouped row at the filtered event feed", () => {
    const g = groupAlerts([missedRound("20:04"), missedRound("18:04")])[0]!;
    expect(g.href).toBe(`/events?type=PATROL_MISSED&guard=${GUARD}`);
  });

  it("keeps a different route, a different guard and a different type apart", () => {
    const groups = groupAlerts([
      missedRound("20:04"),
      missedRound("18:04"),
      missedRound("19:00", { payload: { patrol_id: "p-x", route_id: "route-parking", route_name: "Parking levels", body: "Expected 19:00" }, title: "Mohan Lal missed patrol Parking levels" }),
      missedRound("19:30", { guard_id: GUARD2, guards: { full_name: "Bhupendra Singh" }, title: "Bhupendra Singh missed patrol Perimeter round" }),
      ev({ type: "OUTAGE", title: "Mohan Lal: no location for 10+ min", payload: { body: "Last seen 17:22" }, created_at: "2026-09-14T21:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.count)).toEqual([1, 2, 1, 1]);
    expect(groups[0]!.latest.type).toBe("OUTAGE");
  });

  it("never folds two agency-wide events without a guard into one row", () => {
    const a = ev({ type: "STAFFING_GAP", guard_id: null, guards: null, title: "Sobha Dream Acres is 2 guards short" });
    const b = ev({ type: "STAFFING_GAP", guard_id: null, guards: null, title: "Sobha Dream Acres is 2 guards short" });
    expect(groupAlerts([a, b])).toHaveLength(2);
  });

  it("groups late starts by shift, and raises the group to the worst severity it contains", () => {
    const groups = groupAlerts([
      ev({ type: "LATE_START", shift_id: "shift-9", guard_id: GUARD, title: "Mohan Lal has not started the shift", created_at: "2026-09-14T17:00:00.000Z" }),
      ev({ type: "LATE_START", shift_id: "shift-9", guard_id: GUARD, severity: "critical", title: "Mohan Lal has not started the shift", created_at: "2026-09-14T17:30:00.000Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.severity).toBe("critical");
    expect(groups[0]!.openCount).toBe(2);
  });

  it("orders groups newest first and caps how many are shown", () => {
    const many = Array.from({ length: ALERT_FEED_LIMIT + 5 }, (_, i) =>
      ev({ type: "OUTAGE", guard_id: `g-${i}`, guards: { full_name: `Guard ${i}` }, title: `Guard ${i}: no location for 10+ min`, created_at: `2026-09-14T${String(i % 24).padStart(2, "0")}:00:00.000Z` }),
    );
    const groups = groupAlerts(many);
    expect(groups).toHaveLength(ALERT_FEED_LIMIT);
    expect(groups[0]!.latest.created_at > groups[1]!.latest.created_at).toBe(true);
  });

  it("is idempotent — regrouping its own output changes nothing", () => {
    const input = [missedRound("20:04"), missedRound("18:04"), ev({ type: "OUTAGE", title: "Mohan Lal: no location for 10+ min" })];
    const once = groupAlerts(input);
    const twice = groupAlerts(once.flatMap((g) => g.events));
    expect(twice.map((g) => [g.key, g.count])).toEqual(once.map((g) => [g.key, g.count]));
  });

  it("ignores a repeated id", () => {
    const e = missedRound("20:04");
    expect(groupAlerts([e, e]).at(0)!.count).toBe(1);
  });
});

describe("mergeAlert (the realtime INSERT path)", () => {
  it("merges a new round into the existing group instead of adding a duplicate row", () => {
    const groups = groupAlerts([missedRound("18:04"), missedRound("17:04")]);
    expect(groups).toHaveLength(1);

    const merged = mergeAlert(groups, missedRound("20:04"));
    expect(merged).toHaveLength(1);
    expect(merged[0]!.count).toBe(3);
    expect(merged[0]!.latest.created_at).toBe("2026-09-14T20:04:00.000Z");
    expect(merged[0]!.headline).toBe("Mohan Lal missed 3 patrol rounds on Perimeter round");
  });

  it("adds a row for an unrelated event and puts it on top", () => {
    const groups = groupAlerts([missedRound("18:04")]);
    const merged = mergeAlert(groups, ev({ type: "OUTAGE", guard_id: GUARD2, guards: { full_name: "Bhupendra Singh" }, title: "Bhupendra Singh: no location for 10+ min", created_at: "2026-09-14T22:00:00.000Z" }));
    expect(merged).toHaveLength(2);
    expect(merged[0]!.latest.type).toBe("OUTAGE");
  });

  it("is a no-op when the event is already on the panel", () => {
    const first = missedRound("18:04");
    const groups = groupAlerts([first, missedRound("17:04")]);
    expect(mergeAlert(groups, first)).toBe(groups);
  });

  it("still honours the row cap after merging", () => {
    const groups = groupAlerts(
      Array.from({ length: ALERT_FEED_LIMIT }, (_, i) =>
        ev({ type: "OUTAGE", guard_id: `g-${i}`, guards: { full_name: `Guard ${i}` }, title: `Guard ${i}: no location`, created_at: `2026-09-14T0${i % 10}:00:00.000Z` }),
      ),
    );
    const merged = mergeAlert(groups, ev({ type: "OUTAGE", guard_id: "g-new", guards: { full_name: "New Guard" }, title: "New Guard: no location", created_at: "2026-09-14T23:00:00.000Z" }));
    expect(merged).toHaveLength(ALERT_FEED_LIMIT);
    expect(merged[0]!.guardName).toBe("New Guard");
  });
});

describe("alertGroupKey / alertEventHref", () => {
  it("keys a guardless event by its own id so it can never merge", () => {
    const e = ev({ type: "OUTAGE", guard_id: null, guards: null });
    expect(alertGroupKey(e)).toBe(`OUTAGE|${e.id}`);
  });

  it("prefers the shift, then the guard, then the feed", () => {
    expect(alertEventHref(ev({ shift_id: "s1" }))).toBe("/attendance/s1");
    expect(alertEventHref(ev({ shift_id: null }))).toBe(`/guards/${GUARD}`);
    expect(alertEventHref(ev({ shift_id: null, guard_id: null }))).toBe("/events");
  });
});
