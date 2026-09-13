import { describe, expect, it } from "vitest";
import {
  buildDigestAnomalies,
  buildDigestText,
  buildGuardScorecards,
  buildMusterMatrix,
  buildSiteRangeSummary,
  daysInRange,
  digestTotals,
  leaveDays,
  monthRange,
  MUSTER_BLANK,
  scheduledWindow,
  sortScorecards,
  summarisePatrols,
  summariseShiftRows,
  toPunchRows,
  type Digest,
  type PatrolReportRow,
  type ShiftReportRow,
} from "../reports";

function shift(over: Partial<ShiftReportRow> = {}): ShiftReportRow {
  return {
    id: "s1",
    shift_date: "2026-09-01",
    guard_id: "g1",
    guard_name: "Ramesh Yadav",
    employee_code: "SSS-001",
    site_id: "site1",
    site_name: "Prestige Tech Park",
    shift_type: "Day",
    scheduled_start: "2026-09-01T06:00:00+05:30",
    scheduled_end: "2026-09-01T14:00:00+05:30",
    started_at: "2026-09-01T06:05:00+05:30",
    ended_at: "2026-09-01T14:02:00+05:30",
    start_lat: 12.9,
    start_lng: 77.6,
    start_in_fence: true,
    start_accuracy_m: 10,
    end_lat: 12.9,
    end_lng: 77.6,
    end_in_fence: true,
    end_accuracy_m: 10,
    late_by_min: 5,
    worked_minutes: 475,
    away_seconds: 120,
    attendance: "present",
    status: "completed",
    trust: "clean",
    flags: [],
    device: { model: "Redmi 9A", app_version: "1.0.0" },
    ...over,
  };
}

function patrol(over: Partial<PatrolReportRow> = {}): PatrolReportRow {
  return {
    id: "p1",
    site_name: "Prestige Tech Park",
    route_name: "Perimeter round",
    guard_name: "Ramesh Yadav",
    expected_at: "2026-09-01T08:00:00+05:30",
    started_at: "2026-09-01T08:05:00+05:30",
    ended_at: "2026-09-01T08:20:00+05:30",
    status: "completed",
    photos: 2,
    distance_m: 400,
    duration_s: 900,
    ...over,
  };
}

describe("scheduledWindow", () => {
  it("formats the scheduled start/end as HH:mm–HH:mm", () => {
    expect(scheduledWindow(shift())).toBe("06:00–14:00");
  });
  it("is blank when either end is missing", () => {
    expect(scheduledWindow(shift({ scheduled_start: null }))).toBe("");
  });
});

describe("daysInRange / monthRange", () => {
  it("lists every calendar day inclusive", () => {
    expect(daysInRange("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
  it("computes month bounds including leap Feb", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});

describe("buildMusterMatrix", () => {
  it("keeps the best outcome per guard per day and totals codes", () => {
    const rows = [
      shift({ shift_date: "2026-09-01", attendance: "half_day" }),
      shift({ shift_date: "2026-09-01", attendance: "present", id: "s2" }), // same guard/day, better outcome wins
      shift({ shift_date: "2026-09-02", attendance: "absent", id: "s3" }),
    ];
    const days = daysInRange("2026-09-01", "2026-09-03");
    const [row] = buildMusterMatrix(rows, days);
    expect(row!.cells["2026-09-01"]).toBe("P");
    expect(row!.cells["2026-09-02"]).toBe("A");
    expect(row!.cells["2026-09-03"]).toBe(MUSTER_BLANK);
    expect(row!.present_days).toBe(1);
    expect(row!.absent_days).toBe(1);
  });
});

describe("toPunchRows", () => {
  it("flattens in/out into separate rows ordered by time", () => {
    const rows = toPunchRows([shift()]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.direction).toBe("in");
    expect(rows[1]!.direction).toBe("out");
  });
  it("skips a punch that never happened", () => {
    const rows = toPunchRows([shift({ ended_at: null })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.direction).toBe("in");
  });
});

describe("summarisePatrols", () => {
  it("computes compliance % per route", () => {
    const rows = [patrol({ status: "completed" }), patrol({ status: "late", id: "p2" }), patrol({ status: "missed", id: "p3" })];
    const [summary] = summarisePatrols(rows);
    expect(summary!.expected).toBe(3);
    expect(summary!.completed).toBe(1);
    expect(summary!.compliance_pct).toBeCloseTo(33.3, 1);
  });
});

describe("leaveDays", () => {
  it("is inclusive of both ends", () => {
    expect(leaveDays("2026-09-01", "2026-09-03")).toBe(3);
    expect(leaveDays("2026-09-01", "2026-09-01")).toBe(1);
  });
  it("is 0 for an invalid range", () => {
    expect(leaveDays("2026-09-05", "2026-09-01")).toBe(0);
  });
});

describe("digestTotals / buildDigestText", () => {
  it("sums sites and renders WhatsApp-safe plain text", () => {
    const sites = [
      { site_name: "Prestige", scheduled: 4, present: 3, half_day: 0, absent: 1, on_leave: 0, flagged: 1, pending: 0 },
      { site_name: "Brigade", scheduled: 2, present: 2, half_day: 0, absent: 0, on_leave: 0, flagged: 0, pending: 0 },
    ];
    const totals = digestTotals(sites);
    expect(totals.scheduled).toBe(6);
    expect(totals.present).toBe(5);
    const digest: Digest = { date: "2026-09-01", agencyName: "Sentinel Security", sites, totals, anomalies: [{ kind: "late_start", text: "Prestige: Ramesh late" }] };
    const text = buildDigestText(digest, "1 Sept 2026");
    expect(text).toContain("Sentinel Security");
    expect(text).toContain("Prestige: Ramesh late");
    expect(text).toContain("Late starts (1)");
    expect(text).not.toMatch(/[#*_`]/); // no markdown noise
  });
  it("says there are no anomalies when the list is empty", () => {
    const totals = { site_name: "All sites", scheduled: 2, present: 2, half_day: 0, absent: 0, on_leave: 0, flagged: 0, pending: 0 };
    const digest: Digest = { date: "2026-09-01", agencyName: "X", sites: [totals], totals, anomalies: [] };
    expect(buildDigestText(digest)).toContain("No anomalies.");
  });
});

describe("buildDigestAnomalies", () => {
  it("maps known event types to anomaly buckets and drops the rest", () => {
    const anomalies = buildDigestAnomalies([
      { type: "LATE_START", title: "Ramesh started late", site_name: "Prestige" },
      { type: "PATROL_MISSED", title: "Missed perimeter round", site_name: "Prestige" },
      { type: "CHECK_IN", title: "Ramesh checked in", site_name: "Prestige" },
    ]);
    expect(anomalies).toEqual([
      { kind: "late_start", text: "Prestige: Ramesh started late" },
      { kind: "missed_patrol", text: "Prestige: Missed perimeter round" },
    ]);
  });
});

describe("summariseShiftRows", () => {
  it("computes rates matching guard_scorecard's math", () => {
    const rows = [
      shift({ attendance: "present", flags: [] }),
      shift({ id: "s2", attendance: "half_day", flags: ["LATE_START"], trust: "flagged" }),
      shift({ id: "s3", attendance: "absent", started_at: null, ended_at: null }),
    ];
    const s = summariseShiftRows(rows);
    expect(s.scheduled).toBe(3);
    expect(s.present).toBe(1);
    expect(s.half_day).toBe(1);
    expect(s.absent).toBe(1);
    expect(s.flagged).toBe(1);
    expect(s.punctuality_pct).toBe(50); // 1 of 2 started shifts had no LATE_START flag
    expect(s.attendance_rate).toBeCloseTo((100 * 2) / 3, 1);
  });
});

describe("buildSiteRangeSummary", () => {
  it("groups by site and sorts by name", () => {
    const rows = [shift({ site_id: "b", site_name: "Brigade" }), shift({ id: "s2", site_id: "a", site_name: "Alpha" })];
    const sites = buildSiteRangeSummary(rows);
    expect(sites.map((s) => s.site_name)).toEqual(["Alpha", "Brigade"]);
    expect(sites[0]!.scheduled).toBe(1);
  });
});

describe("buildGuardScorecards / sortScorecards", () => {
  it("aggregates per guard and merges in patrol counts from a side map", () => {
    const rows = [shift({ guard_id: "g1", attendance: "present" }), shift({ id: "s2", guard_id: "g2", guard_name: "Suresh Gowda", attendance: "absent", started_at: null, ended_at: null })];
    const patrolCounts = new Map([["g1", { patrols: 4, missed: 1 }]]);
    const cards = buildGuardScorecards(rows, patrolCounts);
    expect(cards).toHaveLength(2);
    const ramesh = cards.find((c) => c.guard_id === "g1")!;
    expect(ramesh.patrols).toBe(4);
    expect(ramesh.missed_patrols).toBe(1);
    const suresh = cards.find((c) => c.guard_id === "g2")!;
    expect(suresh.patrols).toBe(0);

    const sorted = sortScorecards(cards, "guard_name", "asc");
    expect(sorted.map((c) => c.guard_name)).toEqual(["Ramesh Yadav", "Suresh Gowda"]);
    const desc = sortScorecards(cards, "guard_name", "desc");
    expect(desc.map((c) => c.guard_name)).toEqual(["Suresh Gowda", "Ramesh Yadav"]);
  });
});
