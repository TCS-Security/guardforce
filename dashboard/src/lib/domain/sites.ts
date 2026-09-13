import type { Polygon, Position } from "geojson";

// ---------------------------------------------------------------------------
// Fence geometry helpers (FENCE-1)
// ---------------------------------------------------------------------------

export const RADIUS_MIN_M = 100;
export const RADIUS_MAX_M = 1000;
export const LEEWAY_MIN_M = 0;
export const LEEWAY_MAX_M = 300;

export type LngLat = [number, number];

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Parses "12.9354, 77.6925" (or "12.9354 77.6925", or a Google Maps URL fragment). */
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const m = input
    .replace(/^.*?@/, "")
    .match(/(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

/** Drops a trailing duplicate of the first vertex, so callers work with an open ring. */
export function openRing(ring: Position[]): LngLat[] {
  const pts = ring.map((p) => [Number(p[0]), Number(p[1])] as LngLat);
  if (pts.length > 1) {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
  }
  return pts;
}

export type PolygonCheck = { ok: true; polygon: Polygon } | { ok: false; error: string };

/**
 * Validates a drawn perimeter (an *open* ring of [lng, lat] vertices) and returns a
 * closed GeoJSON Polygon geometry ready to store in `sites.polygon`.
 */
export function validatePolygonRing(ring: LngLat[]): PolygonCheck {
  const pts = openRing(ring);
  if (pts.length < 3) return { ok: false, error: "A perimeter needs at least 3 points." };
  for (const [lng, lat] of pts) {
    if (!isValidLatLng(lat, lng)) return { ok: false, error: "Perimeter has a point outside valid coordinates." };
  }
  const seen = new Set(pts.map((p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`));
  if (seen.size < 3) return { ok: false, error: "A perimeter needs at least 3 distinct points." };
  return { ok: true, polygon: { type: "Polygon", coordinates: [[...pts, pts[0]!]] } };
}

/** Reads a stored `sites.polygon` value into an open ring; null when absent/invalid. */
export function polygonRing(value: unknown): LngLat[] | null {
  if (!value || typeof value !== "object") return null;
  const g = value as { type?: string; coordinates?: Position[][] };
  if (g.type !== "Polygon" || !Array.isArray(g.coordinates) || !g.coordinates[0]) return null;
  const ring = openRing(g.coordinates[0]);
  return ring.length >= 3 ? ring : null;
}

/** Average of the vertices — good enough to centre the map / set the site pin. */
export function ringCentroid(ring: LngLat[]): { lat: number; lng: number } | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return { lng: sum[0] / ring.length, lat: sum[1] / ring.length };
}

/** Human label for the fence, e.g. "Radius 180 m + 50 m leeway" / "Polygon, 5 points + 50 m leeway". */
export function fenceLabel(site: { fence_type: string; radius_m: number; leeway_m: number; polygon?: unknown }) {
  if (site.fence_type === "polygon") {
    const ring = polygonRing(site.polygon);
    return `Polygon${ring ? `, ${ring.length} points` : ""} · +${site.leeway_m} m leeway`;
  }
  return `Radius ${site.radius_m} m · +${site.leeway_m} m leeway`;
}

// ---------------------------------------------------------------------------
// Shift types
// ---------------------------------------------------------------------------

export const SHIFT_TYPE_PRESETS = [
  { name: "Day", start_time: "06:00", end_time: "14:00" },
  { name: "Evening", start_time: "14:00", end_time: "22:00" },
  { name: "Night", start_time: "22:00", end_time: "06:00" },
] as const;

/** "06:00:00" | "06:00" -> 360. Returns null for anything unparseable. */
export function timeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function hhmm(value: string) {
  const mins = timeToMinutes(value);
  if (mins == null) return value;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export type ShiftWindow = { start_time: string; end_time: string };

export function crossesMidnight(win: ShiftWindow) {
  const s = timeToMinutes(win.start_time);
  const e = timeToMinutes(win.end_time);
  if (s == null || e == null) return false;
  return e <= s;
}

/** Length of the shift in minutes; a window ending at/before its start wraps past midnight. */
export function shiftDurationMinutes(win: ShiftWindow): number | null {
  const s = timeToMinutes(win.start_time);
  const e = timeToMinutes(win.end_time);
  if (s == null || e == null) return null;
  const d = e - s;
  return d > 0 ? d : d + 1440;
}

/** "06:00 – 14:00" / "22:00 – 06:00 (+1)" */
export function shiftWindowLabel(win: ShiftWindow) {
  return `${hhmm(win.start_time)} – ${hhmm(win.end_time)}${crossesMidnight(win) ? " (+1)" : ""}`;
}

/** Half-open interval(s) in minutes-from-midnight covered by a shift window. */
function intervals(win: ShiftWindow): [number, number][] {
  const s = timeToMinutes(win.start_time);
  const e = timeToMinutes(win.end_time);
  if (s == null || e == null) return [];
  if (e > s) return [[s, e]];
  return [[s, 1440], [0, e]];
}

/** Do two shift windows overlap on the clock (midnight-crossing aware)? */
export function shiftWindowsOverlap(a: ShiftWindow, b: ShiftWindow) {
  for (const [as, ae] of intervals(a)) {
    for (const [bs, be] of intervals(b)) {
      if (as < be && bs < ae) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Staffing / flags
// ---------------------------------------------------------------------------

export type FlagCount = { code: string; label: string; count: number };

const FLAG_ORDER = ["OUTSIDE_FENCE", "LATE_START", "EARLY_CHECKOUT", "LOCATION_OFF", "TAMPER_SUSPECTED", "SYNCED_LATE", "LOW_ACCURACY"];

/** Tally per-shift flag arrays into an ordered list for the "flags today" panel. */
export function tallyFlags(shifts: { flags: string[] | null }[], labels: Record<string, string> = {}): FlagCount[] {
  const counts = new Map<string, number>();
  for (const s of shifts) {
    for (const f of s.flags ?? []) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: labels[code] ?? code, count }))
    .sort((a, b) => {
      const ai = FLAG_ORDER.indexOf(a.code);
      const bi = FLAG_ORDER.indexOf(b.code);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.code.localeCompare(b.code);
    });
}
