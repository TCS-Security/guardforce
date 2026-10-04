import { distanceOutsideM, haversineM, inFence, type Fence } from "../domain/geo";

// Seed sites (supabase/seed.sql)
const sobha: Fence = { type: "radius", lat: 12.9342, lng: 77.7278, radiusM: 250, leewayM: 50 };
const brigade: Fence = { type: "polygon", lat: 12.8459, lng: 77.5115, radiusM: 150, leewayM: 50, polygon: [[77.51, 12.845], [77.5132, 12.8452], [77.5134, 12.847], [77.5104, 12.8468], [77.51, 12.845]] };

test("centre of a radius fence is inside with zero distance", () => {
  expect(distanceOutsideM(sobha, 12.9342, 77.7278)).toBe(0);
  expect(inFence(sobha, 12.9342, 77.7278)).toBe(true);
});
test("leeway keeps a point just past the radius inside", () => {
  const lat = 12.9342 + 280 / 111_320;
  const d = distanceOutsideM(sobha, lat, 77.7278);
  expect(d).toBeGreaterThan(25); expect(d).toBeLessThan(35);
  expect(inFence(sobha, lat, 77.7278)).toBe(true);
});
test("one kilometre away is outside", () => {
  expect(distanceOutsideM(sobha, 12.942, 77.736)).toBeGreaterThan(700);
  expect(inFence(sobha, 12.942, 77.736)).toBe(false);
});
test("polygon interior is inside, exterior measures to the nearest edge", () => {
  expect(distanceOutsideM(brigade, 12.846, 77.5117)).toBe(0);
  const lat = 12.845 - 100 / 111_320;
  const d = distanceOutsideM(brigade, lat, 77.5115);
  expect(d).toBeGreaterThan(90); expect(d).toBeLessThan(115);
});
test("haversine matches a known distance", () => {
  const d = haversineM(12.9716, 77.5946, 12.9342, 77.7278);
  expect(d).toBeGreaterThan(14_000); expect(d).toBeLessThan(15_500);
});
