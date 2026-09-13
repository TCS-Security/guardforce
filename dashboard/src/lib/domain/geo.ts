import { circle, distance as turfDistance, point, polygon as turfPolygon, booleanPointInPolygon, polygonToLine, pointToLineDistance } from "@turf/turf";
import type { Feature, Polygon } from "geojson";

export type FenceSite = {
  lat: number;
  lng: number;
  fence_type: "radius" | "polygon";
  radius_m: number;
  polygon: unknown;
  leeway_m: number;
};

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  return turfDistance(point([aLng, aLat]), point([bLng, bLat]), { units: "meters" });
}

function asPolygon(p: unknown): Feature<Polygon> | null {
  if (!p || typeof p !== "object") return null;
  const g = p as { type?: string; coordinates?: number[][][] };
  if (g.type !== "Polygon" || !g.coordinates) return null;
  try {
    return turfPolygon(g.coordinates);
  } catch {
    return null;
  }
}

/** Metres beyond the captured perimeter (0 when inside). Mirrors public.site_distance_m in SQL. */
export function distanceOutsideFence(site: FenceSite, lat: number, lng: number) {
  const pt = point([lng, lat]);
  if (site.fence_type === "polygon") {
    const poly = asPolygon(site.polygon);
    if (poly) {
      if (booleanPointInPolygon(pt, poly)) return 0;
      const line = polygonToLine(poly);
      const feature = line.type === "FeatureCollection" ? line.features[0]! : line;
      return pointToLineDistance(pt, feature as Feature<import("geojson").LineString>, { units: "meters" });
    }
  }
  const d = haversineMeters(site.lat, site.lng, lat, lng);
  return Math.max(0, d - site.radius_m);
}

/** FENCE-1: inside when within perimeter + leeway buffer. */
export function isInFence(site: FenceSite, lat: number, lng: number) {
  return distanceOutsideFence(site, lat, lng) <= site.leeway_m;
}

/** GeoJSON polygons for rendering: the captured perimeter and the buffered (leeway) fence. */
export function fenceGeometry(site: FenceSite) {
  if (site.fence_type === "polygon") {
    const poly = asPolygon(site.polygon);
    if (poly) {
      return { perimeter: poly, buffered: null as Feature<Polygon> | null };
    }
  }
  const center = [site.lng, site.lat];
  return {
    perimeter: circle(center, site.radius_m / 1000, { steps: 64, units: "kilometers" }),
    buffered: circle(center, (site.radius_m + site.leeway_m) / 1000, { steps: 64, units: "kilometers" }),
  };
}

/** Bounding box [minLng, minLat, maxLng, maxLat] around a set of points with padding. */
export function bboxAround(points: { lat: number; lng: number }[], padDeg = 0.004): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  return [minLng - padDeg, minLat - padDeg, maxLng + padDeg, maxLat + padDeg];
}
