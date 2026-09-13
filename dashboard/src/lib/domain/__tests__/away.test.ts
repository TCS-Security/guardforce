import { describe, expect, it } from "vitest";
import { awayIntervals, longestAway, totalAwaySeconds, trackingGaps, trailGeoJson } from "../away";

const p = (min: number, inFence: boolean | null, extra: { lat?: number; lng?: number; distance_m?: number } = {}) => ({
  recorded_at: new Date(Date.UTC(2026, 8, 13, 6, min)).toISOString(),
  in_fence: inFence,
  ...extra,
});

describe("awayIntervals (BRK-1)", () => {
  it("is empty when the guard never leaves", () => {
    expect(awayIntervals([p(0, true), p(5, true), p(10, true)])).toEqual([]);
  });

  it("measures a single excursion from first out-of-fence ping to the return", () => {
    const intervals = awayIntervals([p(0, true), p(5, false), p(10, false), p(20, true)]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.seconds).toBe(15 * 60);
    expect(intervals[0]!.pings).toBe(2);
  });

  it("separates two excursions", () => {
    const intervals = awayIntervals([p(0, true), p(5, false), p(10, true), p(20, false), p(30, true)]);
    expect(intervals.map((i) => i.seconds)).toEqual([5 * 60, 10 * 60]);
    expect(totalAwaySeconds(intervals)).toBe(15 * 60);
  });

  it("bounds a still-open excursion with the given end time", () => {
    const until = new Date(Date.UTC(2026, 8, 13, 6, 40)).toISOString();
    const intervals = awayIntervals([p(0, true), p(20, false)], until);
    expect(intervals[0]!.seconds).toBe(20 * 60);
  });

  it("tracks the farthest distance recorded while away", () => {
    const intervals = awayIntervals([p(0, false, { distance_m: 120 }), p(5, false, { distance_m: 430 }), p(10, true)]);
    expect(intervals[0]!.maxDistanceM).toBe(430);
  });

  it("treats an unknown fence state as inside, not away", () => {
    expect(awayIntervals([p(0, null), p(5, null)])).toEqual([]);
  });

  it("ignores ping order", () => {
    const intervals = awayIntervals([p(20, true), p(5, false), p(0, true)]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.seconds).toBe(15 * 60);
  });

  it("picks the longest absence", () => {
    const intervals = awayIntervals([p(0, false), p(5, true), p(10, false), p(40, true)]);
    expect(longestAway(intervals)!.seconds).toBe(30 * 60);
    expect(longestAway([])).toBeNull();
  });
});

describe("trackingGaps", () => {
  it("flags a silence that breaks the trail's own rhythm", () => {
    const gaps = trackingGaps([p(0, true), p(4, true), p(8, true), p(40, true)], 10);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.minutes).toBe(32);
  });

  it("finds nothing in a dense trail", () => {
    expect(trackingGaps([p(0, true), p(4, true), p(8, true), p(12, true)], 10)).toEqual([]);
  });

  it("does not flag every sample of a coarse but steady trail", () => {
    const coarse = [0, 30, 60, 90, 120].map((m) => p(m, true));
    expect(trackingGaps(coarse, 10)).toEqual([]);
  });

  it("still flags a real outage inside a coarse trail", () => {
    const trail = [p(0, true), p(30, true), p(60, true), p(180, true), p(210, true)];
    const gaps = trackingGaps(trail, 10);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.minutes).toBe(120);
  });

  it("needs at least three pings to judge a rhythm", () => {
    expect(trackingGaps([p(0, true), p(90, true)], 10)).toEqual([]);
  });
});

describe("trailGeoJson", () => {
  it("builds a line and one point per located ping, dropping unlocated ones", () => {
    const { line, points } = trailGeoJson([
      p(0, true, { lat: 12.9, lng: 77.6 }),
      p(5, false, { lat: 12.91, lng: 77.61 }),
      p(10, true),
    ]);
    expect((line.geometry as GeoJSON.LineString).coordinates).toEqual([[77.6, 12.9], [77.61, 12.91]]);
    expect(points.features).toHaveLength(2);
    expect(points.features[1]!.properties).toMatchObject({ in_fence: 0 });
  });
});
