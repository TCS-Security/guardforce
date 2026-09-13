import { describe, expect, it } from "vitest";
import { deriveAttendance, deriveTrust, lateMinutes, punctuality } from "../attendance";

const base = {
  status: "completed" as const,
  started_at: "2026-09-13T06:05:00+05:30",
  scheduled_start: "2026-09-13T06:00:00+05:30",
  scheduled_end: "2026-09-13T14:00:00+05:30",
  worked_minutes: 470,
  override_attendance: null,
};

describe("deriveAttendance", () => {
  it("is present when at least half the scheduled duration was worked", () => {
    expect(deriveAttendance(base)).toBe("present");
    expect(deriveAttendance({ ...base, worked_minutes: 240 })).toBe("present");
  });
  it("is half_day below the ratio but above zero", () => {
    expect(deriveAttendance({ ...base, worked_minutes: 239 })).toBe("half_day");
    expect(deriveAttendance({ ...base, worked_minutes: 1 })).toBe("half_day");
  });
  it("is absent for a void shift regardless of minutes (LOC-1)", () => {
    expect(deriveAttendance({ ...base, status: "void_location_off" })).toBe("absent");
  });
  it("honours a manager override", () => {
    expect(deriveAttendance({ ...base, status: "absent", started_at: null, override_attendance: "present" })).toBe("present");
  });
  it("is on_leave when approved leave covers a shift that never started", () => {
    expect(deriveAttendance({ ...base, started_at: null, status: "scheduled" }, { onLeave: true })).toBe("on_leave");
  });
  it("is pending for a scheduled shift that has not started", () => {
    expect(deriveAttendance({ ...base, started_at: null, status: "scheduled" })).toBe("pending");
  });
  it("respects a custom half-day ratio", () => {
    expect(deriveAttendance({ ...base, worked_minutes: 300 }, { halfDayRatio: 0.75 })).toBe("half_day");
  });
});

describe("deriveTrust", () => {
  it("is suspicious for mock GPS or location off", () => {
    expect(deriveTrust([], 10, 80, true)).toBe("suspicious");
    expect(deriveTrust(["LOCATION_OFF"], 10, 80)).toBe("suspicious");
    expect(deriveTrust(["TAMPER_SUSPECTED"], 10, 80)).toBe("suspicious");
  });
  it("is flagged for fence, accuracy, battery or late sync", () => {
    expect(deriveTrust(["OUTSIDE_FENCE"], 10, 80)).toBe("flagged");
    expect(deriveTrust([], 51, 80)).toBe("flagged");
    expect(deriveTrust([], 10, 9)).toBe("flagged");
    expect(deriveTrust(["SYNCED_LATE"], 10, 80)).toBe("flagged");
  });
  it("is clean otherwise", () => {
    expect(deriveTrust(["LATE_START"], 50, 10)).toBe("clean");
  });
});

describe("lateMinutes", () => {
  it("computes late minutes against the threshold", () => {
    expect(lateMinutes("2026-09-13T06:00:00Z", "2026-09-13T06:20:00Z")).toEqual({ late: 20, isLate: true });
    expect(lateMinutes("2026-09-13T06:00:00Z", "2026-09-13T06:15:00Z")).toEqual({ late: 15, isLate: false });
    expect(lateMinutes("2026-09-13T06:00:00Z", "2026-09-13T05:50:00Z")).toEqual({ late: 0, isLate: false });
    expect(lateMinutes(null, "2026-09-13T05:50:00Z")).toEqual({ late: 0, isLate: false });
  });
});

describe("punctuality", () => {
  it("returns null with no started shifts", () => {
    expect(punctuality([{ started_at: null, flags: [] }])).toBeNull();
  });
  it("counts on-time starts", () => {
    expect(punctuality([
      { started_at: "x", flags: [] },
      { started_at: "x", flags: ["LATE_START"] },
      { started_at: "x", flags: ["OUTSIDE_FENCE"] },
      { started_at: null, flags: [] },
    ])).toBeCloseTo(66.67, 1);
  });
});
