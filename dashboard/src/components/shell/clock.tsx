"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

/** Live IST clock for the top bar — the control room's reference time. */
export function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="font-mono text-xs text-muted-foreground">--:--</span>;
  return (
    <span className="font-mono tabular text-xs text-muted-foreground" title={tz}>
      {formatInTimeZone(now, tz, "EEE d MMM · HH:mm")} <span className="opacity-60">IST</span>
    </span>
  );
}
