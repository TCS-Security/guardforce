import { describe, it, expect } from "vitest";
import {
  parseLatLng, isValidLatLng, validatePolygonRing, polygonRing, ringCentroid, fenceLabel,
  timeToMinutes, crossesMidnight, shiftDurationMinutes, shiftWindowLabel, shiftWindowsOverlap,
  tallyFlags, openRing, SHIFT_TYPE_PRESETS,
} from "../sites";
import type { LngLat } from "../sites";

describe("coordinates", () => {
  it("accepts sane lat/lng and rejects null island / out of range", () => {
    expect(isValidLatLng(12.9354, 77.6925)).toBe(true);
    expect(isValidLatLng(0, 0)).toBe(false);
    expect(isValidLatLng(91, 77)).toBe(false);
    expect(isValidLatLng(12, 181)).toBe(false);
    expect(isValidLatLng("12", 77)).toBe(false);
  });

  it("parses typed coordinate pairs", () => {
    expect(parseLatLng("12.9354, 77.6925")).toEqual({ lat: 12.9354, lng: 77.6925 });
    expect(parseLatLng("  12.9354 77.6925 ")).toEqual({ lat: 12.9354, lng: 77.6925 });
    expect(parseLatLng("https://maps.google.com/@12.9354,77.6925,17z")).toEqual({ lat: 12.9354, lng: 77.6925 });
    expect(parseLatLng("Prestige Tech Park")).toBeNull();
    expect(parseLatLng("999, 999")).toBeNull();
  });
});

describe("polygon fences", () => {
  const tri: LngLat[] = [[77.51, 12.845], [77.5132, 12.8452], [77.5134, 12.847]];

  it("closes a valid ring", () => {
    const res = validatePolygonRing(tri);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.polygon.type).toBe("Polygon");
    expect(res.polygon.coordinates[0]).toHaveLength(4);
    expect(res.polygon.coordinates[0]![0]).toEqual(res.polygon.coordinates[0]![3]);
  });

  it("tolerates an already-closed ring", () => {
    const res = validatePolygonRing([...tri, tri[0]!]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.polygon.coordinates[0]).toHaveLength(4);
  });

  it("rejects too few or duplicate points", () => {
    expect(validatePolygonRing(tri.slice(0, 2))).toMatchObject({ ok: false });
    expect(validatePolygonRing([tri[0]!, tri[0]!, tri[0]!])).toMatchObject({ ok: false });
    expect(validatePolygonRing([[77.5, 12.8], [77.6, 12.9], [999, 12.9]])).toMatchObject({ ok: false });
  });

  it("round-trips through polygonRing", () => {
    const res = validatePolygonRing(tri);
    if (!res.ok) throw new Error("expected valid");
    expect(polygonRing(res.polygon)).toEqual(tri);
    expect(polygonRing(null)).toBeNull();
    expect(polygonRing({ type: "Point", coordinates: [1, 2] })).toBeNull();
    expect(polygonRing({ type: "Polygon", coordinates: [[[1, 2], [1, 2]]] })).toBeNull();
  });

  it("drops the closing vertex once only", () => {
    expect(openRing([[1, 1], [2, 2], [3, 3], [1, 1]])).toEqual([[1, 1], [2, 2], [3, 3]]);
    expect(openRing([[1, 1], [2, 2], [3, 3]])).toHaveLength(3);
  });

  it("centroids a ring", () => {
    expect(ringCentroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual({ lng: 1, lat: 1 });
    expect(ringCentroid([])).toBeNull();
  });

  it("labels fences", () => {
    expect(fenceLabel({ fence_type: "radius", radius_m: 180, leeway_m: 50 })).toBe("Radius 180 m · +50 m leeway");
    const res = validatePolygonRing(tri);
    if (!res.ok) throw new Error("expected valid");
    expect(fenceLabel({ fence_type: "polygon", radius_m: 150, leeway_m: 50, polygon: res.polygon }))
      .toBe("Polygon, 3 points · +50 m leeway");
  });
});

describe("shift windows", () => {
  it("parses times, including postgres time output", () => {
    expect(timeToMinutes("06:00")).toBe(360);
    expect(timeToMinutes("22:00:00")).toBe(1320);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("nope")).toBeNull();
  });

  it("detects midnight crossing", () => {
    expect(crossesMidnight({ start_time: "22:00", end_time: "06:00" })).toBe(true);
    expect(crossesMidnight({ start_time: "06:00", end_time: "14:00" })).toBe(false);
    expect(crossesMidnight({ start_time: "08:00", end_time: "08:00" })).toBe(true);
  });

  it("computes duration across midnight", () => {
    expect(shiftDurationMinutes({ start_time: "06:00", end_time: "14:00" })).toBe(480);
    expect(shiftDurationMinutes({ start_time: "22:00", end_time: "06:00" })).toBe(480);
    expect(shiftDurationMinutes({ start_time: "23:30", end_time: "00:30" })).toBe(60);
    expect(shiftDurationMinutes({ start_time: "bad", end_time: "00:30" })).toBeNull();
  });

  it("labels windows", () => {
    expect(shiftWindowLabel({ start_time: "06:00:00", end_time: "14:00:00" })).toBe("06:00 – 14:00");
    expect(shiftWindowLabel({ start_time: "22:00:00", end_time: "06:00:00" })).toBe("22:00 – 06:00 (+1)");
  });

  it("detects overlaps, wrapping past midnight", () => {
    const day = { start_time: "06:00", end_time: "14:00" };
    const evening = { start_time: "14:00", end_time: "22:00" };
    const night = { start_time: "22:00", end_time: "06:00" };
    expect(shiftWindowsOverlap(day, evening)).toBe(false);
    expect(shiftWindowsOverlap(evening, night)).toBe(false);
    expect(shiftWindowsOverlap(night, day)).toBe(false);
    expect(shiftWindowsOverlap(night, { start_time: "05:00", end_time: "13:00" })).toBe(true);
    expect(shiftWindowsOverlap(day, { start_time: "13:00", end_time: "21:00" })).toBe(true);
    expect(shiftWindowsOverlap(day, day)).toBe(true);
  });

  it("ships the three PRD presets without overlaps", () => {
    expect(SHIFT_TYPE_PRESETS.map((p) => p.name)).toEqual(["Day", "Evening", "Night"]);
    for (const a of SHIFT_TYPE_PRESETS) {
      for (const b of SHIFT_TYPE_PRESETS) {
        if (a !== b) expect(shiftWindowsOverlap(a, b)).toBe(false);
      }
    }
  });
});

describe("tallyFlags", () => {
  it("counts and orders flags by severity of interest", () => {
    const rows = [
      { flags: ["LATE_START", "OUTSIDE_FENCE"] },
      { flags: ["LATE_START"] },
      { flags: null },
      { flags: ["WEIRD_ONE"] },
    ];
    expect(tallyFlags(rows, { OUTSIDE_FENCE: "Outside fence", LATE_START: "Late start" })).toEqual([
      { code: "OUTSIDE_FENCE", label: "Outside fence", count: 1 },
      { code: "LATE_START", label: "Late start", count: 2 },
      { code: "WEIRD_ONE", label: "WEIRD_ONE", count: 1 },
    ]);
    expect(tallyFlags([])).toEqual([]);
  });
});
