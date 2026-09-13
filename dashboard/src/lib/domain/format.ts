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
