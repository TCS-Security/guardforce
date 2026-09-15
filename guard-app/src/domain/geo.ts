/** Local mirror of public.site_distance_m / is_in_fence. Polygon points are [lng, lat] like GeoJSON. */
export type Fence = { type: "radius" | "polygon"; lat: number; lng: number; radiusM: number; leewayM: number; polygon?: [number, number][] };

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInPolygon(ring: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const denom = yj - yi === 0 ? 1e-12 : yj - yi;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denom + xi) inside = !inside;
  }
  return inside;
}

function distanceToRing(ring: [number, number][], lat: number, lng: number): number {
  const kLat = (R * Math.PI) / 180, kLng = kLat * Math.cos(rad(lat));
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ax = (a[0] - lng) * kLng, ay = (a[1] - lat) * kLat, bx = (b[0] - lng) * kLng, by = (b[1] - lat) * kLat;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, len2 === 0 ? 0 : (-ax * dx - ay * dy) / len2));
    const cx = ax + t * dx, cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best === Infinity ? 0 : best;
}

/** Metres beyond the raw fence edge; 0 when inside. */
export function distanceOutsideM(f: Fence, lat: number, lng: number): number {
  if (f.type === "polygon" && f.polygon && f.polygon.length >= 3) {
    return pointInPolygon(f.polygon, lng, lat) ? 0 : distanceToRing(f.polygon, lat, lng);
  }
  return Math.max(0, haversineM(f.lat, f.lng, lat, lng) - f.radiusM);
}

export const inFence = (f: Fence, lat: number, lng: number) => distanceOutsideM(f, lat, lng) <= f.leewayM;
