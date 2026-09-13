import { describe, expect, it } from "vitest";
import { canUnassign, cellCoverage, describeWeekdays, weekDays, weekdayOf } from "../roster";

describe("weekDays", () => {
  it("returns Monday to Sunday for any day in the week", () => {
    expect(weekDays(new Date("2026-09-16T10:00:00"))).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
    ]);
  });
  it("treats Sunday as the last day, not the first", () => {
    expect(weekDays(new Date("2026-09-13T10:00:00"))[6]).toBe("2026-09-13");
  });
});

describe("weekdayOf", () => {
  it("reads a date string as a local day index", () => {
    expect(weekdayOf("2026-09-13")).toBe(0);
    expect(weekdayOf("2026-09-14")).toBe(1);
  });
});

describe("describeWeekdays", () => {
  it("names common patterns", () => {
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(describeWeekdays([0, 6])).toBe("Weekends");
    expect(describeWeekdays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(describeWeekdays([3, 1, 1])).toBe("Mon, Wed");
  });
});

describe("cellCoverage", () => {
  const s = (status: string, started = false) => ({ id: "x", guard_id: "g", status, attendance: "pending", started_at: started ? "t" : null });
  it("counts filled posts and shortfall", () => {
    expect(cellCoverage([s("scheduled"), s("in_progress", true)], 3)).toEqual({ filled: 2, required: 3, short: 1, onDuty: 1, worked: 1 });
  });
  it("excludes cancelled rows and never reports a negative shortfall", () => {
    expect(cellCoverage([s("scheduled"), s("cancelled")], 1)).toMatchObject({ filled: 1, short: 0 });
  });
});

describe("canUnassign", () => {
  it("allows removing a shift that has not begun", () => {
    expect(canUnassign({ status: "scheduled", started_at: null })).toBe(true);
    expect(canUnassign(undefined)).toBe(true);
  });
  it("refuses once the guard has checked in or the shift is closed", () => {
    expect(canUnassign({ status: "in_progress", started_at: "t" })).toBe(false);
    expect(canUnassign({ status: "completed", started_at: "t" })).toBe(false);
    expect(canUnassign({ status: "void_location_off", started_at: "t" })).toBe(false);
  });
});
