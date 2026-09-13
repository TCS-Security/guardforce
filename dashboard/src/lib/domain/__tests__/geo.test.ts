import { describe, expect, it } from "vitest";
import { distanceOutsideFence, fenceGeometry, haversineMeters, isInFence, bboxAround } from "../geo";

const radiusSite = { lat: 12.9354, lng: 77.6925, fence_type: "radius" as const, radius_m: 150, polygon: null, leeway_m: 50 };
const polySite = {
  lat: 12.8459, lng: 77.5115, fence_type: "polygon" as const, radius_m: 150, leeway_m: 50,
  polygon: { type: "Polygon", coordinates: [[[77.5100, 12.8450], [77.5132, 12.8452], [77.5134, 12.8470], [77.5104, 12.8468], [77.5100, 12.8450]]] },
};

describe("haversineMeters", () => {
  it("is ~111 m per 0.001 deg latitude", () => {
    expect(haversineMeters(12.9, 77.6, 12.901, 77.6)).toBeCloseTo(111.2, 0);
  });
});

describe("radius fence (FENCE-1)", () => {
  it("is 0 m outside when inside the radius", () => {
    expect(distanceOutsideFence(radiusSite, 12.9355, 77.6926)).toBe(0);
  });
  it("applies the leeway buffer", () => {
    // ~190 m north: beyond 150 m radius but inside 150+50 buffer
    const lat = 12.9354 + 190 / 111_200;
    expect(distanceOutsideFence(radiusSite, lat, 77.6925)).toBeGreaterThan(30);
    expect(isInFence(radiusSite, lat, 77.6925)).toBe(true);
    // ~230 m north: outside the buffered fence
    expect(isInFence(radiusSite, 12.9354 + 230 / 111_200, 77.6925)).toBe(false);
  });
  it("renders perimeter and buffered rings", () => {
    const g = fenceGeometry(radiusSite);
    expect(g.perimeter.geometry.type).toBe("Polygon");
    expect(g.buffered?.geometry.type).toBe("Polygon");
  });
});

describe("polygon fence", () => {
  it("is inside the drawn polygon", () => {
    expect(isInFence(polySite, 12.8460, 77.5117)).toBe(true);
    expect(distanceOutsideFence(polySite, 12.8460, 77.5117)).toBe(0);
  });
  it("is outside well beyond the polygon + leeway", () => {
    expect(isInFence(polySite, 12.8500, 77.5200)).toBe(false);
  });
  it("uses only the perimeter for polygons", () => {
    expect(fenceGeometry(polySite).buffered).toBeNull();
  });
  it("falls back to the radius when the polygon is invalid", () => {
    expect(isInFence({ ...polySite, polygon: { type: "Nope" } }, 12.8459, 77.5115)).toBe(true);
  });
});

describe("bboxAround", () => {
  it("returns null for no points and pads otherwise", () => {
    expect(bboxAround([])).toBeNull();
    expect(bboxAround([{ lat: 1, lng: 2 }], 0.1)).toEqual([1.9, 0.9, 2.1, 1.1]);
  });
});
