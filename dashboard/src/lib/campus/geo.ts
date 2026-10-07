/**
 * Circular checkpoint fences, the way the floor survey checks them: the guard's fix has to
 * fall inside the checkpoint's radius, widened by the fix's own accuracy only up to a cap so
 * a ±200 m indoor fix cannot pass a ±35 m fence.
 */
export type LatLng = { lat: number; lng: number };

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Accuracy is credited up to this many metres, never more. */
export const MAX_ACCURACY_CREDIT_M = 15;

export type FenceCheck = { distance_m: number; allowed_m: number; inside: boolean };

export function checkFence(checkpoint: LatLng & { radius_m: number }, fix: LatLng & { accuracy_m?: number }): FenceCheck {
  const distance_m = Math.round(distanceM(checkpoint, fix));
  const allowed_m = checkpoint.radius_m + Math.min(fix.accuracy_m ?? 0, MAX_ACCURACY_CREDIT_M);
  return { distance_m, allowed_m, inside: distance_m <= allowed_m };
}

/** Moves a point by metres north and east. Used to place floors and fixes around a site. */
export function offsetM(p: LatLng, northM: number, eastM: number): LatLng {
  const lat = p.lat + (northM / EARTH_M) * (180 / Math.PI);
  const lng = p.lng + (eastM / (EARTH_M * Math.cos(rad(p.lat)))) * (180 / Math.PI);
  return { lat, lng };
}

/** 28.5355° N, 77.3910° E */
export function fmtLatLng(p: LatLng, digits = 4): string {
  return `${Math.abs(p.lat).toFixed(digits)}° ${p.lat >= 0 ? "N" : "S"}, ${Math.abs(p.lng).toFixed(digits)}° ${p.lng >= 0 ? "E" : "W"}`;
}
