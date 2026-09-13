"use client";

import { useSyncExternalStore } from "react";
import { formatInTimeZone } from "date-fns-tz";

/** Ticks every 15s. An external store keeps the server render ("--:--") stable. */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

/** Live IST clock for the top bar — the control room's reference time. */
export function Clock({ tz }: { tz: string }) {
  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 15_000),
    () => null,
  );
  if (now === null) return <span className="font-mono text-xs text-muted-foreground">--:--</span>;
  return (
    <span className="font-mono tabular text-xs text-muted-foreground" title={tz}>
      {formatInTimeZone(now * 15_000, tz, "EEE d MMM · HH:mm")} <span className="opacity-60">IST</span>
    </span>
  );
}
