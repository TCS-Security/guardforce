import { describe, expect, it } from "vitest";
import {
  canUnassign,
  cellCoverage,
  dayAnchor,
  describeWeekdays,
  isInMonth,
  isoDate,
  monthDays,
  monthGridDays,
  monthKey,
  monthLabel,
  parseRosterView,
  rangeLabel,
  rangeSpanDays,
  rosterDays,
  shiftMonth,
  stepAnchor,
  weekDays,
  weekdayOf,
} from "../roster";

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

describe("dayAnchor", () => {
  it("round-trips every yyyy-MM-dd back to itself", () => {
    // The roster anchors on a date string from the URL; noon keeps a UTC offset or a
    // DST jump from rolling it onto the previous day (the IST trap in CLAUDE.md).
    for (const d of ["2026-01-01", "2026-03-29", "2026-09-15", "2026-10-25", "2026-12-31", "2024-02-29"]) {
      expect(isoDate(dayAnchor(d))).toBe(d);
    }
  });
});

describe("monthDays", () => {
  it("covers the whole month and nothing else", () => {
    const sep = monthDays(dayAnchor("2026-09-15"));
    expect(sep).toHaveLength(30);
    expect(sep[0]).toBe("2026-09-01");
    expect(sep.at(-1)).toBe("2026-09-30");
  });
  it("knows leap Februaries", () => {
    expect(monthDays(dayAnchor("2024-02-10"))).toHaveLength(29);
    expect(monthDays(dayAnchor("2026-02-10"))).toHaveLength(28);
    expect(monthDays(dayAnchor("2024-02-10")).at(-1)).toBe("2024-02-29");
  });
});

describe("monthGridDays", () => {
  it("pads to whole Monday-first weeks either side", () => {
    // 1 Sep 2026 is a Tuesday, 30 Sep a Wednesday.
    const grid = monthGridDays(dayAnchor("2026-09-15"));
    expect(grid).toHaveLength(35);
    expect(grid[0]).toBe("2026-08-31");
    expect(grid.at(-1)).toBe("2026-10-04");
    expect(weekdayOf(grid[0]!)).toBe(1);
    expect(weekdayOf(grid.at(-1)!)).toBe(0);
  });
  it("adds no leading padding when the 1st is a Monday", () => {
    // 1 Jun 2026 is a Monday.
    expect(monthGridDays(dayAnchor("2026-06-20"))[0]).toBe("2026-06-01");
  });
  it("uses six rows when the month spills over five weeks", () => {
    // 1 Aug 2026 is a Saturday: 5 lead days + 31 = 36 cells, so 42.
    const grid = monthGridDays(dayAnchor("2026-08-01"));
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-07-27");
    expect(grid.at(-1)).toBe("2026-09-06");
  });
  it("always contains every day of the month, in order, as whole weeks", () => {
    for (const d of ["2024-02-01", "2026-01-15", "2026-11-30", "2027-05-09"]) {
      const grid = monthGridDays(dayAnchor(d));
      expect(grid.length % 7).toBe(0);
      for (const day of monthDays(dayAnchor(d))) expect(grid).toContain(day);
      expect([...grid].sort()).toEqual(grid);
    }
  });
});

describe("shiftMonth", () => {
  it("steps whole months without end-of-month clamping", () => {
    expect(isoDate(shiftMonth(dayAnchor("2026-01-31"), 1))).toBe("2026-02-01");
    expect(monthKey(shiftMonth(dayAnchor("2026-01-31"), 1))).toBe("2026-02");
  });
  it("crosses the year boundary both ways", () => {
    expect(monthKey(shiftMonth(dayAnchor("2026-12-05"), 1))).toBe("2027-01");
    expect(monthKey(shiftMonth(dayAnchor("2026-01-05"), -1))).toBe("2025-12");
  });
  it("returns to the same month after stepping forward and back", () => {
    const back = shiftMonth(shiftMonth(dayAnchor("2026-08-31"), 1), -1);
    expect(monthKey(back)).toBe("2026-08");
  });
});

describe("isInMonth / monthLabel", () => {
  it("separates the month from its grid padding", () => {
    const anchor = dayAnchor("2026-09-15");
    expect(isInMonth("2026-09-01", anchor)).toBe(true);
    expect(isInMonth("2026-08-31", anchor)).toBe(false);
    expect(isInMonth("2026-10-04", anchor)).toBe(false);
    expect(monthLabel(anchor)).toBe("September 2026");
  });
});

describe("rosterDays / stepAnchor", () => {
  it("gives the week grid or the month grid for the same anchor", () => {
    const anchor = dayAnchor("2026-09-15");
    expect(rosterDays(anchor, "week")).toHaveLength(7);
    expect(rosterDays(anchor, "month")).toHaveLength(35);
  });
  it("steps by the active unit", () => {
    const anchor = dayAnchor("2026-09-15");
    expect(isoDate(stepAnchor(anchor, "week", 1))).toBe("2026-09-22");
    expect(isoDate(stepAnchor(anchor, "week", -1))).toBe("2026-09-08");
    expect(monthKey(stepAnchor(anchor, "month", 1))).toBe("2026-10");
    expect(monthKey(stepAnchor(anchor, "month", -1))).toBe("2026-08");
  });
});

describe("parseRosterView", () => {
  it("only accepts the two views and falls back to the week", () => {
    expect(parseRosterView("month")).toBe("month");
    expect(parseRosterView("week")).toBe("week");
    expect(parseRosterView("quarter")).toBe("week");
    expect(parseRosterView(undefined)).toBe("week");
  });
});

describe("rangeSpanDays / rangeLabel", () => {
  it("counts a range inclusively", () => {
    expect(rangeSpanDays("2026-09-14", "2026-09-20")).toBe(7);
    expect(rangeSpanDays("2026-08-31", "2026-10-04")).toBe(35);
    expect(rangeSpanDays("2026-09-14", "2026-09-14")).toBe(1);
  });
  it("names the filled range the way the toolbar shows it", () => {
    expect(rangeLabel("2026-09-14", "2026-09-20")).toBe("14–20 Sep 2026");
    expect(rangeLabel("2026-08-31", "2026-10-04")).toBe("31 Aug – 4 Oct 2026");
    expect(rangeLabel("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 – 3 Jan 2027");
    expect(rangeLabel("2026-09-14", "2026-09-14")).toBe("14 Sep 2026");
  });
});
