"use client";

import { useEffect, useState } from "react";

/**
 * The sample day's clock, ticking. Starts at the instant the server built the data (which may
 * be a shifted demo clock, see `demoClock`) and advances in real time from there, so a stay
 * timer started on the server keeps counting up on the client without jumping.
 */
export function useDemoNow(serverNow: string, everyMs = 15_000): Date {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const t = setInterval(() => setNow(new Date(Date.now() + offset)), everyMs);
    return () => clearInterval(t);
  }, [offset, everyMs]);
  return now;
}

/** One-off read of the same clock, for event handlers. */
export function demoInstant(serverNow: string, mountedAt: number): Date {
  return new Date(new Date(serverNow).getTime() + (Date.now() - mountedAt));
}
