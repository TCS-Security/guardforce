import { describe, expect, it } from "vitest";
import {
  balanceRemaining, fmtLeaveRange, leaveDays, monthBounds, monthGrid, monthLabel, parseMonthParam,
  rangesOverlap, shiftMonth, staffingImpact, THIN_COVER_THRESHOLD,
} from "../leave";

describe("leaveDays (inclusive)", () => {
  it("counts both endpoints for a single day", () => {
    expect(leaveDays("2026-09-16", "2026-09-16")).toBe(1);
  });
  it("is inclusive across a range", () => {
    expect(leaveDays("2026-09-16", "2026-09-17")).toBe(2);
    expect(leaveDays("2026-09-20", "2026-09-25")).toBe(6);
  });
  it("crosses month and year boundaries", () => {
    expect(leaveDays("2026-09-30", "2026-10-02")).toBe(3);
    expect(leaveDays("2026-12-30", "2027-01-02")).toBe(4);
  });
  it("returns 0 for an invalid or reversed range", () => {
    expect(leaveDays("2026-09-17", "2026-09-16")).toBe(0);
    expect(leaveDays("nope", "2026-09-16")).toBe(0);
  });
});

describe("rangesOverlap", () => {
  it("detects shared days in every direction", () => {
    expect(rangesOverlap("2026-09-16", "2026-09-17", "2026-09-17", "2026-09-20")).toBe(true);
    expect(rangesOverlap("2026-09-17", "2026-09-20", "2026-09-16", "2026-09-17")).toBe(true);
    expect(rangesOverlap("2026-09-01", "2026-09-30", "2026-09-16", "2026-09-16")).toBe(true);
  });
  it("is false when ranges only touch at the edges", () => {
    expect(rangesOverlap("2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17")).toBe(false);
  });
});

describe("fmtLeaveRange", () => {
  it("single day shows the full date once", () => {
    expect(fmtLeaveRange("2026-09-16", "2026-09-16")).toBe("16 Sep 2026");
  });
  it("compresses within a month", () => {
    expect(fmtLeaveRange("2026-09-16", "2026-09-17")).toBe("16–17 Sep 2026");
  });
  it("spans months and years", () => {
    expect(fmtLeaveRange("2026-09-30", "2026-10-02")).toBe("30 Sep – 2 Oct 2026");
    expect(fmtLeaveRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });
});

describe("balanceRemaining", () => {
  it("subtracts used from total per capped type", () => {
    const b = { casual_total: 12, casual_used: 2, earned_total: 15, earned_used: 5 };
    expect(balanceRemaining(b, "casual")).toBe(10);
    expect(balanceRemaining(b, "earned")).toBe(10);
  });
  it("unpaid leave has no cap", () => {
    expect(balanceRemaining({ casual_total: 12, casual_used: 0, earned_total: 15, earned_used: 0 }, "unpaid")).toBeNull();
    expect(balanceRemaining(null, "unpaid")).toBeNull();
  });
  it("guards without a row get the schema defaults", () => {
    expect(balanceRemaining(null, "casual")).toBe(12);
    expect(balanceRemaining(undefined, "earned")).toBe(15);
  });
});

describe("staffingImpact", () => {
  const req = { guard_id: "g1", site_id: "s1", start_date: "2026-09-16", end_date: "2026-09-18" };

  it("counts other guards on approved leave at the same site", () => {
    const approved = [
      { guard_id: "g2", site_id: "s1", start_date: "2026-09-17", end_date: "2026-09-17", full_name: "B" },
      { guard_id: "g3", site_id: "s1", start_date: "2026-09-18", end_date: "2026-09-20", full_name: "C" },
    ];
    const impact = staffingImpact(req, approved);
    expect(impact.count).toBe(2);
    expect(impact.names).toEqual(["B", "C"]);
    // 18th has g3 + the request itself = 2 concurrent
    expect(impact.maxPerDay).toBe(2);
  });

  it("ignores the requester, other sites and non-overlapping leave", () => {
    const approved = [
      { guard_id: "g1", site_id: "s1", start_date: "2026-09-16", end_date: "2026-09-16", full_name: "Self" },
      { guard_id: "g4", site_id: "s2", start_date: "2026-09-16", end_date: "2026-09-16", full_name: "Other site" },
      { guard_id: "g5", site_id: "s1", start_date: "2026-09-19", end_date: "2026-09-20", full_name: "Late" },
    ];
    expect(staffingImpact(req, approved)).toEqual({ count: 0, names: [], maxPerDay: 1 });
  });

  it("flags thin cover when concurrency reaches the threshold", () => {
    const approved = [
      { guard_id: "g2", site_id: "s1", start_date: "2026-09-16", end_date: "2026-09-18", full_name: "B" },
      { guard_id: "g3", site_id: "s1", start_date: "2026-09-16", end_date: "2026-09-18", full_name: "C" },
    ];
    const impact = staffingImpact(req, approved);
    expect(impact.maxPerDay).toBe(THIN_COVER_THRESHOLD + 1);
    expect(impact.maxPerDay).toBeGreaterThanOrEqual(THIN_COVER_THRESHOLD);
  });

  it("returns zero impact when the request has no site", () => {
    expect(staffingImpact({ ...req, site_id: null }, [])).toEqual({ count: 0, names: [], maxPerDay: 0 });
  });
});

describe("monthGrid", () => {
  it("covers every day of the month in complete Sunday-first weeks", () => {
    const cells = monthGrid(2026, 9); // 1 Sep 2026 is a Tuesday
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toEqual({ date: "2026-08-30", inMonth: false });
    const inMonth = cells.filter((c) => c.inMonth).map((c) => c.date);
    expect(inMonth[0]).toBe("2026-09-01");
    expect(inMonth[inMonth.length - 1]).toBe("2026-09-30");
    expect(inMonth.length).toBe(30);
    // each week starts on Sunday and ends on Saturday
    for (let i = 0; i < cells.length; i += 7) {
      expect(new Date(`${cells[i]!.date}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(new Date(`${cells[i + 6]!.date}T00:00:00Z`).getUTCDay()).toBe(6);
    }
  });

  it("handles February exactly (28 days, no padding weeks when aligned)", () => {
    const cells = monthGrid(2026, 2); // 1 Feb 2026 is a Sunday
    expect(cells.length).toBe(28);
    expect(cells[0]!.date).toBe("2026-02-01");
    expect(cells.every((c) => c.inMonth)).toBe(true);
  });

  it("is empty for an invalid month", () => {
    expect(monthGrid(2026, 0)).toEqual([]);
    expect(monthGrid(2026, 13)).toEqual([]);
  });

  it("monthBounds spans the padded grid", () => {
    expect(monthBounds(2026, 9)).toEqual({ from: "2026-08-30", to: "2026-10-03" });
    expect(monthBounds(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("month params and labels", () => {
  it("parses YYYY-MM strictly", () => {
    expect(parseMonthParam("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam("2026-9")).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth(2026, 9, -1)).toBe("2026-08");
    expect(shiftMonth(2026, 1, -1)).toBe("2025-12");
    expect(shiftMonth(2026, 12, 1)).toBe("2027-01");
  });
  it("labels the month", () => {
    expect(monthLabel(2026, 9)).toBe("September 2026");
  });
});
