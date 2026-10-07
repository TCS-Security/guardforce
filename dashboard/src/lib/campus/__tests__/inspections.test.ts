import { describe, expect, it } from "vitest";
import { failActions, floorStates, ledgerStats, score, submitBlocker } from "../inspections";
import { checkFence, distanceM, offsetM } from "../geo";
import { CHECKLIST } from "../sample";
import type { Floor, FloorInspection } from "../types";

const allOk = Object.fromEntries(CHECKLIST.map((c) => [c.id, true]));

describe("geofence", () => {
  const cp = { lat: 12.9354, lng: 77.6925, radius_m: 35 };

  it("measures metres between two fixes", () => {
    const p = offsetM(cp, 30, 40);
    expect(Math.round(distanceM(cp, p))).toBe(50);
  });

  it("passes inside the radius and fails outside it", () => {
    expect(checkFence(cp, offsetM(cp, 12, 0)).inside).toBe(true);
    expect(checkFence(cp, offsetM(cp, 80, 0)).inside).toBe(false);
  });

  it("credits a poor fix's accuracy only up to the cap", () => {
    const fix = { ...offsetM(cp, 45, 0), accuracy_m: 200 };
    const r = checkFence(cp, fix);
    expect(r.allowed_m).toBe(50);
    expect(r.inside).toBe(true);
    expect(checkFence(cp, { ...offsetM(cp, 60, 0), accuracy_m: 200 }).inside).toBe(false);
  });
});

describe("checklist", () => {
  it("blocks submit until every required question is answered", () => {
    expect(submitBlocker(CHECKLIST, {}, {})).toMatch(/8 questions still unanswered/);
    expect(submitBlocker(CHECKLIST, allOk, {})).toBeNull();
  });

  it("demands a photo for a failed check that needs evidence", () => {
    const answers = { ...allOk, "ck-03": false };
    expect(submitBlocker(CHECKLIST, answers, {})).toMatch(/CHK-03/);
    expect(submitBlocker(CHECKLIST, answers, { "ck-03": true })).toBeNull();
  });

  it("does not demand a photo where the item does not ask for one", () => {
    expect(submitBlocker(CHECKLIST, { ...allOk, "ck-06": false }, {})).toBeNull();
  });

  it("turns each failure into a task routed to its owner", () => {
    const acts = failActions(CHECKLIST, { ...allOk, "ck-05": false, "ck-01": false }, {}, "2nd floor");
    expect(acts.map((a) => a.notify)).toEqual(["Housekeeping lead", "Electrical maintenance"]);
    expect(acts[1]!.task).toContain("2nd floor");
    expect(score(CHECKLIST, { ...allOk, "ck-05": false }).label).toBe("7/8 OK");
  });
});

describe("floorStates", () => {
  const floors = [{ id: "f1" }, { id: "f2" }] as Floor[];
  const insp = (floor_id: string, finished_at: string, state: FloorInspection["state"] = "completed") =>
    ({ id: floor_id + finished_at, floor_id, finished_at, started_at: finished_at, state, answers: {} }) as unknown as FloorInspection;

  it("uses today's survey, else due before the cut-off and missed after it", () => {
    const today = "2026-10-08";
    const morning = new Date("2026-10-08T05:00:00Z"); // 10:30 IST
    const evening = new Date("2026-10-08T13:30:00Z"); // 19:00 IST
    const list = [insp("f1", "2026-10-08T04:00:00Z", "pending_approval"), insp("f2", "2026-10-07T05:00:00Z")];
    expect(floorStates(floors, list, today, morning).map((s) => s.state)).toEqual(["pending_approval", "due"]);
    expect(floorStates(floors, list, today, evening).map((s) => s.state)).toEqual(["pending_approval", "missed"]);
  });
});

describe("ledgerStats", () => {
  it("counts clean surveys, compliance and average duration", () => {
    const mk = (fail: boolean, mins: number) => ({
      answers: { ...allOk, ...(fail ? { "ck-01": false } : {}) }, gps_ok: true,
      started_at: "2026-10-08T04:00:00Z", finished_at: new Date(Date.parse("2026-10-08T04:00:00Z") + mins * 60_000).toISOString(),
    }) as unknown as FloorInspection;
    const s = ledgerStats([mk(false, 30), mk(false, 40), mk(true, 20), mk(false, 30)], CHECKLIST.length);
    expect(s).toMatchObject({ total: 4, clean: 3, flagged: 1, compliance: 75, avgMin: 30, gpsPct: 100 });
  });
});
