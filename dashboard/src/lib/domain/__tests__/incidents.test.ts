import { describe, expect, it } from "vitest";
import {
  fmtGap,
  incidentSummary,
  incidentTally,
  nextStatuses,
  parseIncidentFilters,
  plottable,
  positionState,
  requiresResolution,
  shiftDate,
  type GuardPosition,
} from "../incidents";
import { fromLocalInput, toLocalInput } from "../format";

const fix = (over: Partial<GuardPosition> = {}): GuardPosition => ({
  lat: 12.9354,
  lng: 77.6925,
  gap_seconds: 60,
  stale: false,
  location_enabled: true,
  source: "ping",
  ...over,
});

describe("parseIncidentFilters (F11)", () => {
  it("opens on the last 30 days, because incidents are rare", () => {
    const f = parseIncidentFilters({}, "2026-09-15");
    expect(f).toMatchObject({ from: "2026-08-16", to: "2026-09-15", siteId: null, type: null, severity: null, status: null });
  });

  it("keeps explicit dates and drops 'all'", () => {
    const f = parseIncidentFilters({ from: "2026-01-01", to: "2026-01-31", site: "all" }, "2026-09-15");
    expect(f.from).toBe("2026-01-01");
    expect(f.to).toBe("2026-01-31");
    expect(f.siteId).toBeNull();
  });

  it("refuses values outside the enums rather than passing them to Postgres", () => {
    const f = parseIncidentFilters({ type: "alien_abduction", severity: "apocalyptic", status: "maybe" }, "2026-09-15");
    expect(f.type).toBeNull();
    expect(f.severity).toBeNull();
    expect(f.status).toBeNull();
  });

  it("accepts the synthetic 'unresolved' status the list bar offers", () => {
    expect(parseIncidentFilters({ status: "unresolved" }, "2026-09-15").status).toBe("unresolved");
    expect(parseIncidentFilters({ status: "investigating" }, "2026-09-15").status).toBe("investigating");
  });
});

describe("shiftDate", () => {
  it("crosses month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-09-15", 30)).toBe("2026-10-15");
  });
});

describe("incidentTally", () => {
  it("counts by status and flags unclosed critical ones", () => {
    const rows = [
      { status: "open", severity: "critical" },
      { status: "investigating", severity: "high" },
      { status: "resolved", severity: "critical" },
      { status: "resolved", severity: "low" },
    ] as const;
    expect(incidentTally([...rows])).toEqual({ total: 4, open: 1, investigating: 1, resolved: 2, critical: 1 });
  });

  it("is empty-safe", () => {
    expect(incidentTally([])).toEqual({ total: 0, open: 0, investigating: 0, resolved: 0, critical: 0 });
  });
});

describe("positionState", () => {
  it("trusts a fresh fix", () => {
    expect(positionState(fix())).toBe("located");
  });

  it("never plots a guard whose device had location off", () => {
    expect(positionState(fix({ location_enabled: false }))).toBe("location_off");
  });

  it("never plots a fix the database called stale", () => {
    expect(positionState(fix({ stale: true, gap_seconds: 4000 }))).toBe("stale");
  });

  it("reports no position when nothing was ever recorded", () => {
    expect(positionState(fix({ lat: null, lng: null, source: "none", stale: true }))).toBe("unknown");
  });

  it("only located guards reach the map", () => {
    const rows = [fix(), fix({ stale: true }), fix({ location_enabled: false }), fix({ lat: null, lng: null, source: "none" })];
    expect(plottable(rows)).toHaveLength(1);
  });
});

describe("fmtGap", () => {
  const at = "2026-09-15T10:00:00Z";
  it("calls a fix inside a minute simultaneous", () => {
    expect(fmtGap(30)).toBe("at the time");
  });
  it("says which side of the incident the fix falls on", () => {
    expect(fmtGap(240, "2026-09-15T09:56:00Z", at)).toBe("4m before");
    expect(fmtGap(240, "2026-09-15T10:04:00Z", at)).toBe("4m after");
  });
  it("rolls over into hours", () => {
    expect(fmtGap(4200, "2026-09-15T08:50:00Z", at)).toBe("1h 10m before");
  });
  it("is null-safe", () => {
    expect(fmtGap(null)).toBe("—");
  });
});

describe("life cycle", () => {
  it("offers taking it up or closing it from open", () => {
    expect(nextStatuses("open")).toEqual(["investigating", "resolved"]);
  });
  it("offers only closing once someone is on it", () => {
    expect(nextStatuses("investigating")).toEqual(["resolved"]);
  });
  it("lets a closed incident be re-opened", () => {
    expect(nextStatuses("resolved")).toEqual(["investigating"]);
  });
  it("demands a note only when closing", () => {
    expect(requiresResolution("resolved")).toBe(true);
    expect(requiresResolution("investigating")).toBe(false);
  });
});

describe("incidentSummary", () => {
  it("reads as one line", () => {
    expect(incidentSummary({ type: "theft", severity: "high", site_name: "Metro" })).toBe("Theft · High · Metro");
    expect(incidentSummary({ type: "fire", severity: "low" })).toBe("Fire · Low");
  });
});

describe("datetime-local round trip", () => {
  it("reads a wall-clock form value as IST, not as the server's zone", () => {
    // 18:30 IST on 14 September is 13:00 UTC.
    expect(fromLocalInput("2026-09-14T18:30", "Asia/Kolkata").toISOString()).toBe("2026-09-14T13:00:00.000Z");
  });

  it("renders an instant back into the same wall clock", () => {
    expect(toLocalInput("2026-09-14T13:00:00.000Z", "Asia/Kolkata")).toBe("2026-09-14T18:30");
  });
});
