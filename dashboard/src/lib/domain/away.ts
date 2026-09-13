/**
 * Away-time analysis (BRK-1, core question #4: "break kitna liya").
 *
 * The guard app pings every few minutes. A ping carries whether the guard was inside
 * the buffered fence at that moment; the time between a ping and the next one is
 * attributed to the earlier ping's state. That mirrors public.recompute_away_time in SQL.
 */
export type Ping = {
  recorded_at: string;
  in_fence: boolean | null;
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
};

export type AwayInterval = {
  from: string;
  to: string;
  seconds: number;
  /** Farthest recorded distance beyond the fence during the interval, when known. */
  maxDistanceM: number | null;
  pings: number;
};

/**
 * Groups consecutive out-of-fence pings into intervals. The final ping of a run has no
 * successor to bound it, so the interval ends at the next in-fence ping (or, for a run
 * that is still open, at `until`).
 */
export function awayIntervals(pings: Ping[], until?: string | Date): AwayInterval[] {
  const sorted = [...pings].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const out: AwayInterval[] = [];
  let start: Ping | null = null;
  let maxDistance: number | null = null;
  let count = 0;

  const close = (endAt: string) => {
    if (!start) return;
    const seconds = Math.max(0, Math.round((new Date(endAt).getTime() - new Date(start.recorded_at).getTime()) / 1000));
    if (seconds > 0) out.push({ from: start.recorded_at, to: endAt, seconds, maxDistanceM: maxDistance, pings: count });
    start = null;
    maxDistance = null;
    count = 0;
  };

  for (const p of sorted) {
    if (p.in_fence === false) {
      if (!start) start = p;
      count += 1;
      if (p.distance_m != null) maxDistance = Math.max(maxDistance ?? 0, p.distance_m);
    } else if (start) {
      close(p.recorded_at);
    }
  }
  if (start) {
    const end = until ? new Date(until).toISOString() : sorted[sorted.length - 1]!.recorded_at;
    close(end);
  }
  return out;
}

export function totalAwaySeconds(intervals: AwayInterval[]) {
  return intervals.reduce((a, i) => a + i.seconds, 0);
}

/** Longest single absence — the number a supervisor actually reacts to. */
export function longestAway(intervals: AwayInterval[]) {
  return intervals.reduce<AwayInterval | null>((best, i) => (!best || i.seconds > best.seconds ? i : best), null);
}

/**
 * Silences in the breadcrumb trail: the phone was off, out of signal, or location was
 * disabled.
 *
 * The app's ping interval is adaptive (2–15 min) and older shifts are stored at a
 * coarser cadence, so a fixed threshold alone would flag every normal sample. A gap
 * counts only when it is both past the outage threshold and clearly out of step with
 * this shift's own rhythm.
 */
export function trackingGaps(pings: Ping[], thresholdMin = 10) {
  const sorted = [...pings].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  if (sorted.length < 3) return [];

  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push((new Date(sorted[i]!.recorded_at).getTime() - new Date(sorted[i - 1]!.recorded_at).getTime()) / 60000);
  }
  const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]!;
  const floor = Math.max(thresholdMin, median * 2.5);

  const gaps: { from: string; to: string; minutes: number }[] = [];
  deltas.forEach((minutes, i) => {
    if (minutes >= floor) {
      gaps.push({ from: sorted[i]!.recorded_at, to: sorted[i + 1]!.recorded_at, minutes: Math.round(minutes) });
    }
  });
  return gaps;
}

/** GeoJSON for the breadcrumb trail: one LineString plus a point per ping. */
export function trailGeoJson(pings: Ping[]): { line: GeoJSON.Feature; points: GeoJSON.FeatureCollection } {
  const located = pings
    .filter((p) => p.lat != null && p.lng != null)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  return {
    line: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: located.map((p) => [p.lng!, p.lat!]) },
    },
    points: {
      type: "FeatureCollection",
      features: located.map((p) => ({
        type: "Feature" as const,
        properties: { in_fence: p.in_fence === false ? 0 : 1, at: p.recorded_at },
        geometry: { type: "Point" as const, coordinates: [p.lng!, p.lat!] },
      })),
    },
  };
}
