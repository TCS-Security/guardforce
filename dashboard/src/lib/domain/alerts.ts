import type { EventSeverity, EventType } from "@/lib/supabase/types";
import { fmtDistance } from "./format";

/**
 * Live-alert grouping.
 *
 * The overview feed is a fixed number of slots. Monitors write one event per *occurrence*
 * (one per missed patrol round, one per silence window), so a single guard who skipped three
 * rounds on the same route used to take three visually identical slots — the only difference
 * being a truncated "Expected 18:04" in muted text. Operators read that as a duplicate bug and
 * genuinely new alerts fall off the list.
 *
 * Everything here is pure so the server loader, the first client render and the realtime INSERT
 * handler all collapse the feed exactly the same way.
 */

/** Warn/critical event as the overview and the realtime subscription select it. */
export type AlertEvent = {
  id: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  payload: Record<string, unknown> | unknown | null;
  created_at: string;
  site_id: string | null;
  guard_id: string | null;
  shift_id: string | null;
  acknowledged_at: string | null;
  sites: { name: string } | null;
  guards: { full_name: string } | null;
};

export type AlertGroupMode = "guard_route" | "guard" | "shift" | "none";

export type AlertGroup = {
  /** Stable identity of the thing an operator must act on. */
  key: string;
  mode: AlertGroupMode;
  /** Newest event in the group; drives the timestamp and the type pill. */
  latest: AlertEvent;
  /** Every event behind this row, newest first. */
  events: AlertEvent[];
  count: number;
  /** Highest severity in the group, so one critical repeat is never hidden behind warns. */
  severity: EventSeverity;
  /** One line that says what happened, already pluralised when count > 1. */
  headline: string;
  /** The distinguishing detail of the newest event ("Expected 20:04"). */
  detail: string | null;
  siteName: string | null;
  guardName: string | null;
  routeName: string | null;
  /** Unacknowledged events in the group. */
  openCount: number;
  href: string;
};

/** Groups shown in the overview panel. */
export const ALERT_FEED_LIMIT = 14;
/** Raw events fetched to fill those groups — repeats collapse, so we need more than we show. */
export const ALERT_FETCH_LIMIT = 60;

/**
 * What makes two events "the same thing" for each event type.
 *  - `guard_route`: a missed round is one problem per guard per route, however many rounds.
 *  - `guard`: repeated outages / fence exits / tamper signals from one guard are one story.
 *  - `shift`: already at most one per shift, grouped defensively against a double write.
 *  - `none` (default): every event stands on its own.
 */
export const ALERT_GROUP_MODE: Partial<Record<EventType, AlertGroupMode>> = {
  PATROL_MISSED: "guard_route",
  PATROL_LATE: "guard_route",
  OUTAGE: "guard",
  LOCATION_OFF: "guard",
  FENCE_EXIT: "guard",
  TAMPER_SUSPECTED: "guard",
  SYNCED_LATE: "guard",
  LATE_START: "shift",
  EARLY_CHECKOUT: "shift",
  OUTSIDE_FENCE: "shift",
  SHIFT_VOID: "shift",
};

export function alertGroupMode(type: EventType): AlertGroupMode {
  return ALERT_GROUP_MODE[type] ?? "none";
}

function payloadOf(e: AlertEvent): Record<string, unknown> {
  return e.payload && typeof e.payload === "object" ? (e.payload as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Route a patrol event belongs to. `run_monitors` writes `route_name`/`route_id` into the
 * payload; events written before that migration only carry it inside the title.
 */
export function alertRouteName(e: AlertEvent): string | null {
  const explicit = str(payloadOf(e).route_name);
  if (explicit) return explicit;
  const m = /\b(?:missed|started|completed) patrol\s+(.+?)\s*$/i.exec(e.title);
  return m ? str(m[1]) : null;
}

/** The detail that tells two same-looking events apart. Never hide this from the row. */
export function alertDetail(e: AlertEvent): string | null {
  const p = payloadOf(e);
  const body = str(p.body);
  if (body) return body;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  if (p.distance_m != null) return `${fmtDistance(num(p.distance_m))} from the fence`;
  if (p.late_by_min != null) return `${num(p.late_by_min)} min late`;
  if (p.worked_minutes != null) return `${num(p.worked_minutes)} min worked`;
  if (p.location_off_seconds != null) return `location off for ${Math.round(num(p.location_off_seconds) / 60)} min`;
  return str(p.reason);
}

/**
 * Identity of the alert an event belongs to. Falls back to the event id — never merging — when
 * the row lacks the column the mode groups on, so an agency-wide event is never folded into a
 * guard's row.
 */
export function alertGroupKey(e: AlertEvent): string {
  const site = e.site_id ?? "-";
  switch (alertGroupMode(e.type)) {
    case "guard_route":
      if (e.guard_id) {
        const route = str(payloadOf(e).route_id) ?? alertRouteName(e) ?? "-";
        return `${e.type}|${site}|${e.guard_id}|${route}`;
      }
      break;
    case "guard":
      if (e.guard_id) return `${e.type}|${site}|${e.guard_id}`;
      break;
    case "shift":
      if (e.shift_id) return `${e.type}|${site}|${e.shift_id}`;
      break;
  }
  return `${e.type}|${e.id}`;
}

/** Where a single event points. */
export function alertEventHref(e: AlertEvent): string {
  if (e.shift_id) return `/attendance/${e.shift_id}`;
  if (e.guard_id) return `/guards/${e.guard_id}`;
  return "/events";
}

const SEVERITY_RANK: Record<EventSeverity, number> = { info: 0, warn: 1, critical: 2 };

/** Plural phrasings, so a grouped row reads as one sentence instead of a title plus a badge. */
const GROUP_HEADLINE: Partial<Record<EventType, (n: number, guard: string, route: string | null) => string>> = {
  PATROL_MISSED: (n, g, r) => `${g} missed ${n} patrol rounds${r ? ` on ${r}` : ""}`,
  PATROL_LATE: (n, g, r) => `${g} was late on ${n} patrol rounds${r ? ` on ${r}` : ""}`,
  OUTAGE: (n, g) => `${g}: ${n} location outages`,
  LOCATION_OFF: (n, g) => `${g} turned location off ${n} times`,
  FENCE_EXIT: (n, g) => `${g} left the site fence ${n} times`,
  TAMPER_SUSPECTED: (n, g) => `${g}: ${n} mock-GPS signals`,
  SYNCED_LATE: (n, g) => `${g}: ${n} late syncs`,
};

function newestFirst(a: AlertEvent, b: AlertEvent) {
  const d = Date.parse(b.created_at) - Date.parse(a.created_at);
  // Monitor sweeps stamp a whole batch with the same second, so break ties deterministically.
  return d !== 0 ? d : a.id.localeCompare(b.id);
}

function buildGroup(key: string, events: AlertEvent[]): AlertGroup {
  const latest = events[0]!;
  const count = events.length;
  const guardName = latest.guards?.full_name ?? null;
  const routeName = alertRouteName(latest);
  const template = GROUP_HEADLINE[latest.type];
  const headline =
    count === 1
      ? latest.title
      : template && guardName
        ? template(count, guardName, routeName)
        : `${latest.title} — ${count} times`;

  return {
    key,
    mode: alertGroupMode(latest.type),
    latest,
    events,
    count,
    severity: events.reduce<EventSeverity>((worst, e) => (SEVERITY_RANK[e.severity] > SEVERITY_RANK[worst] ? e.severity : worst), latest.severity),
    headline,
    detail: alertDetail(latest),
    siteName: latest.sites?.name ?? null,
    guardName,
    routeName,
    openCount: events.filter((e) => !e.acknowledged_at).length,
    href: count === 1 ? alertEventHref(latest) : `/events?type=${latest.type}${latest.guard_id ? `&guard=${latest.guard_id}` : ""}`,
  };
}

/**
 * Collapse a flat event feed into one row per thing to act on, newest group first.
 * Duplicate ids are ignored, so it is safe to feed it a list that already contains the event.
 */
export function groupAlerts(events: AlertEvent[], limit = ALERT_FEED_LIMIT): AlertGroup[] {
  const unique = new Map<string, AlertEvent>();
  for (const e of events) if (!unique.has(e.id)) unique.set(e.id, e);

  const buckets = new Map<string, AlertEvent[]>();
  for (const e of [...unique.values()].sort(newestFirst)) {
    const key = alertGroupKey(e);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(e);
    else buckets.set(key, [e]);
  }

  const groups = [...buckets].map(([key, evs]) => buildGroup(key, evs));
  groups.sort((a, b) => newestFirst(a.latest, b.latest));
  return limit > 0 ? groups.slice(0, limit) : groups;
}

/**
 * Realtime INSERT path: fold one new event into the groups already on screen. An event that
 * belongs to an existing group bumps its count and timestamp instead of adding a row, and an
 * event already on screen (a re-delivered notification) changes nothing.
 */
export function mergeAlert(groups: AlertGroup[], event: AlertEvent, limit = ALERT_FEED_LIMIT): AlertGroup[] {
  if (groups.some((g) => g.events.some((e) => e.id === event.id))) return groups;
  return groupAlerts([event, ...groups.flatMap((g) => g.events)], limit);
}
