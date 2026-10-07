import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type Fix = { lat: number; lng: number; accuracyM: number | null; isMock: boolean; atMs: number };
const GOOD_M = 50;

/** Keeps asking for a fresh position until it is accurate enough or 25 s pass. */
export function useLocationFix(active: boolean) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      setSearching(true); setError(null);
      const start = Date.now();
      let best: Fix | null = null;
      try {
        while (!cancelled && Date.now() - start < 25_000) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, mayShowUserSettingsDialog: true });
          const f: Fix = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracyM: loc.coords.accuracy ?? null, isMock: !!loc.mocked, atMs: Date.now() };
          if (!best || (f.accuracyM ?? 999) <= (best.accuracyM ?? 999)) { best = f; if (!cancelled) setFix(f); }
          if ((best.accuracyM ?? 999) <= GOOD_M) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      if (!cancelled) setSearching(false);
    })();
    return () => { cancelled = true; };
  }, [active]);
  return { fix, searching, error, good: (fix?.accuracyM ?? 999) <= GOOD_M };
}

export async function quickFix(): Promise<Fix | null> {
  try {
    const loc = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
    return loc ? { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracyM: loc.coords.accuracy ?? null, isMock: !!loc.mocked, atMs: Date.now() } : null;
  } catch { return null; }
}
