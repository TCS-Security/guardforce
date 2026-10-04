export type Relative = { unit: "now" | "min" | "hr" | "day"; n: number };

/** Time in the agency's timezone (IST for every pilot agency). */
export function makeTime(zone: string) {
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
  const dayShort = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" });
  const dayLong = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long" });
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const safe = (f: () => string) => { try { return f(); } catch { return "--:--"; } };
  return {
    clock: (iso?: string | null | number) => (iso == null ? "--:--" : safe(() => hm.format(typeof iso === "number" ? iso : new Date(iso)))),
    day: (isoDate: string) => safe(() => dayShort.format(new Date(isoDate + "T12:00:00Z"))),
    todayLong: () => dayLong.format(new Date()),
    todayIso: () => ymd.format(new Date()),
    isoAt: (ms: number) => new Date(ms).toISOString(),
    nowIso: () => new Date().toISOString(),
    // Minutes only read as minutes for the first hour; past that a guard wants hours, then days.
    relative: (ms: number, now = Date.now()): Relative => {
      const m = Math.floor(Math.max(0, now - ms) / 60_000);
      if (m < 1) return { unit: "now", n: 0 };
      if (m < 60) return { unit: "min", n: m };
      const h = Math.floor(m / 60);
      return h < 24 ? { unit: "hr", n: h } : { unit: "day", n: Math.floor(h / 24) };
    },
    dateOffset: (days: number) => ymd.format(new Date(Date.now() + days * 86_400_000)),
  };
}
export type TimeText = ReturnType<typeof makeTime>;
