import { format, formatDistanceToNowStrict, differenceInMinutes, isToday, isYesterday } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TZ = "Asia/Kolkata";

export function fmtTime(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), tz, "HH:mm");
}

export function fmtDate(value: string | Date | null | undefined, tz = DEFAULT_TZ, pattern = "d MMM yyyy") {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), tz, pattern);
}

export function fmtDateTime(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  if (!value) return "—";
  const d = new Date(value);
  const z = toZonedTime(d, tz);
  if (isToday(z)) return `Today ${formatInTimeZone(d, tz, "HH:mm")}`;
  if (isYesterday(z)) return `Yesterday ${formatInTimeZone(d, tz, "HH:mm")}`;
  return formatInTimeZone(d, tz, "d MMM, HH:mm");
}

/** "12m ago", "3h ago" — strict, no "about". */
export function fmtAgo(value: string | Date | null | undefined) {
  if (!value) return "never";
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" days", "d").replace(" day", "d");
}

/** 435 minutes -> "7h 15m"; 40 -> "40m"; 0 -> "0m" */
export function fmtMinutes(mins: number | null | undefined) {
  if (mins == null) return "—";
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export function fmtSeconds(secs: number | null | undefined) {
  if (secs == null) return "—";
  return fmtMinutes(secs / 60);
}

export function fmtDistance(m: number | null | undefined) {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtPct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Minutes since a timestamp; null if missing. */
export function minutesSince(value: string | Date | null | undefined, now = new Date()) {
  if (!value) return null;
  return differenceInMinutes(now, new Date(value));
}

/** Local (IST) yyyy-MM-dd for a date, used for shift_date queries. */
export function toLocalDate(value: Date = new Date(), tz = DEFAULT_TZ) {
  return formatInTimeZone(value, tz, "yyyy-MM-dd");
}

export function fmtDayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return format(d, "EEE d MMM");
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  return phone.length > 4 ? `${"•".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : phone;
}

export function fmtPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const p = phone.replace(/\D/g, "");
  if (p.length === 10) return `${p.slice(0, 5)} ${p.slice(5)}`;
  return phone;
}

// ---------------------------------------------------------------------------
// Report formatters
//
// The founder's rule for every report surface and every export: dates read
// DD-MM-YY, times read HH:MM on a 24-hour clock, and seconds are never shown.
// The helpers above keep their own (friendlier, prose-y) formats for the rest
// of the dashboard — these are the ones reports and exports use.
// ---------------------------------------------------------------------------

/** A bare calendar date (`2026-09-01`) as opposed to an instant. */
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Splits a value into its agency-local calendar parts. A plain `yyyy-MM-dd` is
 * taken at face value — shifting it into a timezone would move a shift_date to
 * the wrong day.
 */
function localParts(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  if (!value) return null;
  if (typeof value === "string" && PLAIN_DATE.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return { y: y!, m: m!, d: d!, hh: 0, mm: 0, dateOnly: true };
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const [y, m, d, hh, mm] = formatInTimeZone(at, tz, "yyyy-MM-dd-HH-mm").split("-").map(Number);
  return { y: y!, m: m!, d: d!, hh: hh!, mm: mm!, dateOnly: false };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `2026-09-01` / an ISO instant -> `01-09-26`, in agency time. */
export function fmtReportDate(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  const p = localParts(value, tz);
  if (!p) return "";
  return `${pad2(p.d)}-${pad2(p.m)}-${pad2(p.y % 100)}`;
}

/** An ISO instant -> `06:05`, 24-hour, agency time, never seconds. */
export function fmtReportTime(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  const p = localParts(value, tz);
  if (!p) return "";
  return `${pad2(p.hh)}:${pad2(p.mm)}`;
}

/** An ISO instant -> `01-09-26 06:05`. */
export function fmtReportDateTime(value: string | Date | null | undefined, tz = DEFAULT_TZ) {
  const p = localParts(value, tz);
  if (!p) return "";
  return p.dateOnly ? fmtReportDate(value, tz) : `${fmtReportDate(value, tz)} ${fmtReportTime(value, tz)}`;
}

/**
 * Excel date serial (days since 1899-12-30) for the agency-local wall clock, so
 * a downloaded sheet shows the same HH:MM the dashboard does. Fractional part
 * is the time of day; `null` when there is no value.
 */
export function excelSerial(value: string | Date | null | undefined, tz = DEFAULT_TZ): number | null {
  const p = localParts(value, tz);
  if (!p) return null;
  const days = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000) + 25_569;
  return days + (p.hh * 60 + p.mm) / 1440;
}

/** 510 -> 8.5. Reports quote worked time in decimal hours so a column sums. */
export function hoursFromMinutes(mins: number | null | undefined): number | null {
  if (mins == null || Number.isNaN(mins)) return null;
  return Math.round((mins / 60) * 10) / 10;
}

/** 510 -> "8.5 h". The screen-side twin of `hoursFromMinutes`. */
export function fmtHours(mins: number | null | undefined) {
  const h = hoursFromMinutes(mins);
  return h == null ? "—" : `${h} h`;
}

/**
 * A Google Maps pin for a fix. `?q=<lat>,<lng>` is the documented "search this
 * point" form and drops a pin on both the web map and the mobile apps.
 */
export function mapsUrl(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
