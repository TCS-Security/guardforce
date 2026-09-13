import { describe, expect, it } from "vitest";
import { compliancePct, complianceTone, dueCount, emptyTally, isOverdue, latenessMin, tallyPatrols } from "../patrols";

describe("tallyPatrols", () => {
  it("counts each status", () => {
    const t = tallyPatrols([{ status: "completed" }, { status: "completed" }, { status: "late" }, { status: "missed" }, { status: "scheduled" }]);
    expect(t).toEqual({ completed: 2, late: 1, missed: 1, scheduled: 1, in_progress: 0 });
  });
});

describe("compliancePct (PAT-1)", () => {
  it("is null before any round is due", () => {
    expect(compliancePct({ ...emptyTally(), scheduled: 4 })).toBeNull();
  });
  it("counts on-time rounds against those that were due", () => {
    expect(compliancePct({ ...emptyTally(), completed: 8, late: 1, missed: 1 })).toBe(80);
  });
  it("ignores rounds that have not come due yet", () => {
    expect(compliancePct({ ...emptyTally(), completed: 2, scheduled: 8 })).toBe(100);
    expect(dueCount({ ...emptyTally(), completed: 2, scheduled: 8 })).toBe(2);
  });
  it("is 0 when every due round was missed", () => {
    expect(compliancePct({ ...emptyTally(), missed: 3 })).toBe(0);
  });
});

describe("complianceTone", () => {
  it("passes at the 85% target and degrades below it", () => {
    expect(complianceTone(90)).toBe("present");
    expect(complianceTone(85)).toBe("present");
    expect(complianceTone(70)).toBe("half-day");
    expect(complianceTone(20)).toBe("absent");
    expect(complianceTone(null)).toBe("neutral");
  });
});

describe("latenessMin", () => {
  it("measures the delay against the expected time", () => {
    expect(latenessMin("2026-09-14T02:00:00Z", "2026-09-14T02:22:00Z")).toBe(22);
    expect(latenessMin("2026-09-14T02:00:00Z", "2026-09-14T01:50:00Z")).toBe(0);
    expect(latenessMin(null, "2026-09-14T02:22:00Z")).toBe(0);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-09-14T03:00:00Z");
  it("allows twice the grace before calling a round overdue", () => {
    expect(isOverdue("2026-09-14T02:35:00Z", 15, now)).toBe(false);
    expect(isOverdue("2026-09-14T02:25:00Z", 15, now)).toBe(true);
    expect(isOverdue(null, 15, now)).toBe(false);
  });
});
