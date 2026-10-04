import type { IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/supabase/types";
import type { Tone } from "./status";

/**
 * Incidents (F11) — major occurrences a person reports, as opposed to `events`, which is
 * what the monitors noticed by themselves. The vocabulary lives here so the list, the
 * detail page and the report form all say the same words.
 */
export const INCIDENT_TYPE: Record<IncidentType, { label: string; hint: string }> = {
  fight: { label: "Fight", hint: "Physical altercation between people on site" },
  theft: { label: "Theft", hint: "Property taken — vehicle, cash, equipment, material" },
  fire: { label: "Fire", hint: "Fire, smoke or a triggered fire alarm" },
  medical: { label: "Medical emergency", hint: "Injury, collapse or anything needing an ambulance" },
  trespass: { label: "Trespass", hint: "Unauthorised entry or someone refusing to leave" },
  vandalism: { label: "Vandalism", hint: "Deliberate damage to the client's property" },
  property_damage: { label: "Property damage", hint: "Accidental damage — a vehicle, a gate, a wall" },
  unauthorised_vehicle: { label: "Unauthorised vehicle", hint: "A vehicle entered or left without clearance" },
  altercation_with_client: { label: "Dispute with client staff", hint: "A serious argument involving client or resident staff" },
  other: { label: "Other", hint: "Anything major that does not fit the list" },
};

export const INCIDENT_TYPES = Object.keys(INCIDENT_TYPE) as IncidentType[];

export const INCIDENT_SEVERITY: Record<IncidentSeverity, { label: string; tone: Tone; hint: string }> = {
  low: { label: "Low", tone: "neutral", hint: "Logged for the record; no action outstanding" },
  moderate: { label: "Moderate", tone: "half-day", hint: "Needs a supervisor to follow up" },
  high: { label: "High", tone: "signal", hint: "Client is affected; the owner should know today" },
  critical: { label: "Critical", tone: "absent", hint: "Injury, police, or a threat to the contract" },
};

export const INCIDENT_SEVERITIES = Object.keys(INCIDENT_SEVERITY) as IncidentSeverity[];

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "absent" },
  investigating: { label: "Investigating", tone: "half-day" },
  resolved: { label: "Resolved", tone: "present" },
};

export const INCIDENT_STATUSES = Object.keys(INCIDENT_STATUS) as IncidentStatus[];

/** Incidents are rare, so the log opens on a month rather than on today. */
export const INCIDENT_DEFAULT_DAYS = 30;

export type IncidentFilters = {
  from: string;
  to: string;
  siteId: string | null;
  type: string | null;
  severity: string | null;
  status: string | null;
};

/** URL search params -> filters. Pure, so the defaults can be unit tested. */
export function parseIncidentFilters(
  sp: Record<string, string | string[] | undefined>,
  today: string,
  days = INCIDENT_DEFAULT_DAYS,
): IncidentFilters {
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v !== "all" ? v : null);
  const oneOf = <T extends string>(v: string | null, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? v : null);
  return {
    from: str(sp.from) ?? shiftDate(today, -days),
    to: str(sp.to) ?? today,
    siteId: str(sp.site),
    type: oneOf(str(sp.type), INCIDENT_TYPES),
    severity: oneOf(str(sp.severity), INCIDENT_SEVERITIES),
    status: oneOf(str(sp.status), [...INCIDENT_STATUSES, "unresolved"] as const),
  };
}

/** yyyy-MM-dd shifted by whole days, without dragging a timezone into it. */
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The counts the list page puts in its tiles. */
export function incidentTally(rows: { status: IncidentStatus; severity: IncidentSeverity }[]) {
  return {
    total: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    investigating: rows.filter((r) => r.status === "investigating").length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    critical: rows.filter((r) => r.severity === "critical" && r.status !== "resolved").length,
  };
}

/**
 * How confidently we can say where a guard was when the incident happened.
 *
 * `located` is the only state that may be drawn on the map. Everything else has to read
 * as "unknown", because a fix from an hour earlier — or the last one before the guard
 * switched location off — would put a pin somewhere the guard demonstrably was not.
 */
export type PositionState = "located" | "stale" | "location_off" | "unknown";

export type GuardPosition = {
  lat: number | null;
  lng: number | null;
  gap_seconds: number | null;
  stale: boolean | null;
  location_enabled: boolean | null;
  source: string | null;
};

export function positionState(p: GuardPosition): PositionState {
  if (p.lat == null || p.lng == null || p.source === "none") return "unknown";
  if (p.location_enabled === false) return "location_off";
  if (p.stale) return "stale";
  return "located";
}

export const POSITION_STATE: Record<PositionState, { label: string; tone: Tone; hint: string }> = {
  located: { label: "Located", tone: "present", hint: "A position fix close in time to the incident" },
  stale: { label: "Position unknown", tone: "half-day", hint: "The nearest fix is too far from the incident time to trust" },
  location_off: { label: "Location off", tone: "absent", hint: "The guard's device had location switched off" },
  unknown: { label: "No position", tone: "neutral", hint: "The app never reported a position for this shift" },
};

/** Only located guards go on the map; the rest are listed as unknown. */
export function plottable<T extends GuardPosition>(rows: T[]): (T & { lat: number; lng: number })[] {
  return rows.filter((r): r is T & { lat: number; lng: number } => positionState(r) === "located");
}

/** "at the time", "4m before", "1h 10m after" — how far the fix is from the incident. */
export function fmtGap(seconds: number | null | undefined, recordedAt?: string | null, occurredAt?: string | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return "at the time";
  const mins = Math.round(seconds / 60);
  const span = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  if (!recordedAt || !occurredAt) return span;
  const before = new Date(recordedAt).getTime() < new Date(occurredAt).getTime();
  return `${span} ${before ? "before" : "after"}`;
}

/** The life-cycle move a manager can make next, in the order the detail page offers them. */
export function nextStatuses(status: IncidentStatus): IncidentStatus[] {
  if (status === "open") return ["investigating", "resolved"];
  if (status === "investigating") return ["resolved"];
  return ["investigating"];
}

/** Closing an incident needs a note; re-opening one does not. */
export function requiresResolution(status: IncidentStatus) {
  return status === "resolved";
}

/** One-line summary for the feed row. */
export function incidentSummary(i: { type: IncidentType; severity: IncidentSeverity; site_name?: string | null }) {
  return [INCIDENT_TYPE[i.type].label, INCIDENT_SEVERITY[i.severity].label, i.site_name].filter(Boolean).join(" · ");
}
