/**
 * Pure report shaping: muster-roll matrix, CSV column builders and the owner
 * daily-digest text. Everything here is deterministic and unit-tested; the
 * loaders in `src/lib/data/reports.ts` only fetch rows and hand them over.
 */
import { formatInTimeZone } from "date-fns-tz";
import type { CsvColumn } from "./csv";
import type { AttendanceStatus, EventType, PatrolStatus, ShiftStatus, TrustLevel } from "@/lib/supabase/types";
import { DEFAULT_TZ } from "./format";
import { punctuality } from "./attendance";

// ---------------------------------------------------------------------------
// Row shapes (what the loaders return)
// ---------------------------------------------------------------------------

export type ShiftReportRow = {
  id: string;
  shift_date: string;
  guard_id: string;
  guard_name: string;
  employee_code: string | null;
  site_id: string;
  site_name: string;
  shift_type: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  start_lat: number | null;
  start_lng: number | null;
  start_in_fence: boolean | null;
  start_accuracy_m: number | null;
  end_lat: number | null;
  end_lng: number | null;
  end_in_fence: boolean | null;
  end_accuracy_m: number | null;
  late_by_min: number;
  worked_minutes: number;
  away_seconds: number;
  attendance: AttendanceStatus;
  status: ShiftStatus;
  trust: TrustLevel | null;
  flags: string[];
  device: Record<string, unknown> | null;
};

export type PatrolReportRow = {
  id: string;
  site_name: string;
  route_name: string | null;
  guard_name: string;
  expected_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: PatrolStatus;
  photos: number;
  distance_m: number | null;
  duration_s: number | null;
};

export type LeaveReportRow = {
  id: string;
  guard_name: string;
  employee_code: string | null;
  site_name: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const time = (v: string | null | undefined, tz: string) => (v ? formatInTimeZone(new Date(v), tz, "HH:mm") : "");
const stamp = (v: string | null | undefined, tz: string) => (v ? formatInTimeZone(new Date(v), tz, "yyyy-MM-dd HH:mm:ss") : "");
const num = (v: number | null | undefined, digits = 0) => (v == null ? "" : Number(v).toFixed(digits));
const bool = (v: boolean | null | undefined) => (v == null ? "" : v ? "yes" : "no");

/** "06:00–14:00" for the scheduled window, in agency time. */
export function scheduledWindow(row: Pick<ShiftReportRow, "scheduled_start" | "scheduled_end">, tz = DEFAULT_TZ) {
  if (!row.scheduled_start || !row.scheduled_end) return "";
  return `${time(row.scheduled_start, tz)}–${time(row.scheduled_end, tz)}`;
}

// ---------------------------------------------------------------------------
// Daily attendance report
// ---------------------------------------------------------------------------

export function dailyAttendanceColumns(tz = DEFAULT_TZ): CsvColumn<ShiftReportRow>[] {
  return [
    { header: "Date", value: (r) => r.shift_date },
    { header: "Guard", value: (r) => r.guard_name },
    { header: "Code", value: (r) => r.employee_code },
    { header: "Site", value: (r) => r.site_name },
    { header: "Shift type", value: (r) => r.shift_type },
    { header: "Scheduled", value: (r) => scheduledWindow(r, tz) },
    { header: "In", value: (r) => time(r.started_at, tz) },
    { header: "Out", value: (r) => time(r.ended_at, tz) },
    { header: "Late (min)", value: (r) => r.late_by_min },
    { header: "Worked (min)", value: (r) => r.worked_minutes },
    { header: "Away (min)", value: (r) => num(r.away_seconds / 60, 1) },
    { header: "Attendance", value: (r) => ATTENDANCE_CSV[r.attendance] },
    { header: "Trust", value: (r) => r.trust ?? "" },
    { header: "Flags", value: (r) => r.flags.join(" ") },
  ];
}

const ATTENDANCE_CSV: Record<AttendanceStatus, string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  on_leave: "On leave",
  pending: "Pending",
};

// ---------------------------------------------------------------------------
// Muster roll (one row per guard, one column per day)
// ---------------------------------------------------------------------------

export const MUSTER_CODES: Record<AttendanceStatus, string> = {
  present: "P",
  half_day: "H",
  absent: "A",
  on_leave: "L",
  pending: "–",
};
/** A day with no scheduled shift at all. */
export const MUSTER_BLANK = "–";

export type MusterRow = {
  guard_id: string;
  guard_name: string;
  employee_code: string | null;
  site_name: string;
  /** yyyy-MM-dd -> P | H | A | L | – */
  cells: Record<string, string>;
  present_days: number;
  half_days: number;
  absent_days: number;
  leave_days: number;
  worked_hours: number;
};

/** Every yyyy-MM-dd in [from, to] inclusive (calendar days, no timezone maths). */
export function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** First and last day of the calendar month containing `yyyy-MM`. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const year = y ?? new Date().getUTCFullYear();
  const mon = m ?? 1;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${year}-${pad(mon)}-01`, to: `${year}-${pad(mon)}-${pad(last)}` };
}

/**
 * Muster matrix: one row per guard, one cell per day. A guard with two shifts on
 * the same day keeps the "best" outcome (present > half day > leave > absent) so
 * the register reads the way a paper muster does.
 */
const RANK: Record<AttendanceStatus, number> = { present: 4, half_day: 3, on_leave: 2, absent: 1, pending: 0 };

export function buildMusterMatrix(rows: ShiftReportRow[], days: string[]): MusterRow[] {
  const byGuard = new Map<string, MusterRow & { best: Record<string, AttendanceStatus> }>();

  for (const r of rows) {
    let g = byGuard.get(r.guard_id);
    if (!g) {
      g = {
        guard_id: r.guard_id,
        guard_name: r.guard_name,
        employee_code: r.employee_code,
        site_name: r.site_name,
        cells: Object.fromEntries(days.map((d) => [d, MUSTER_BLANK])),
        present_days: 0,
        half_days: 0,
        absent_days: 0,
        leave_days: 0,
        worked_hours: 0,
        best: {},
      };
      byGuard.set(r.guard_id, g);
    }
    g.worked_hours += r.worked_minutes / 60;
    const prev = g.best[r.shift_date];
    if (!prev || RANK[r.attendance] > RANK[prev]) g.best[r.shift_date] = r.attendance;
  }

  const out: MusterRow[] = [];
  for (const g of byGuard.values()) {
    const { best, ...row } = g;
    for (const day of days) {
      const a = best[day];
      if (!a) continue;
      row.cells[day] = MUSTER_CODES[a];
      if (a === "present") row.present_days += 1;
      else if (a === "half_day") row.half_days += 1;
      else if (a === "absent") row.absent_days += 1;
      else if (a === "on_leave") row.leave_days += 1;
    }
    row.worked_hours = Math.round(row.worked_hours * 10) / 10;
    out.push(row);
  }
  return out.sort((a, b) => a.site_name.localeCompare(b.site_name) || a.guard_name.localeCompare(b.guard_name));
}

export function musterColumns(days: string[]): CsvColumn<MusterRow>[] {
  return [
    { header: "Guard", value: (r) => r.guard_name },
    { header: "Code", value: (r) => r.employee_code },
    { header: "Site", value: (r) => r.site_name },
    ...days.map((d) => ({ header: d.slice(8), value: (r: MusterRow) => r.cells[d] ?? MUSTER_BLANK })),
    { header: "Present days", value: (r) => r.present_days },
    { header: "Half days", value: (r) => r.half_days },
    { header: "Absent", value: (r) => r.absent_days },
    { header: "Leave", value: (r) => r.leave_days },
    { header: "Worked hours", value: (r) => r.worked_hours.toFixed(1) },
  ];
}

// ---------------------------------------------------------------------------
// Punch in / out report
// ---------------------------------------------------------------------------

export type PunchRow = {
  shift_id: string;
  shift_date: string;
  guard_name: string;
  employee_code: string | null;
  site_name: string;
  shift_type: string | null;
  direction: "in" | "out";
  at: string;
  lat: number | null;
  lng: number | null;
  in_fence: boolean | null;
  accuracy_m: number | null;
  device: string;
};

function deviceLabel(device: Record<string, unknown> | null) {
  if (!device) return "";
  const model = typeof device.model === "string" ? device.model : "";
  const app = typeof device.app_version === "string" ? `v${device.app_version}` : "";
  return [model, app].filter(Boolean).join(" ");
}

/** Flattens shifts into one row per physical punch, ordered by time. */
export function toPunchRows(rows: ShiftReportRow[]): PunchRow[] {
  const out: PunchRow[] = [];
  for (const r of rows) {
    const base = {
      shift_id: r.id,
      shift_date: r.shift_date,
      guard_name: r.guard_name,
      employee_code: r.employee_code,
      site_name: r.site_name,
      shift_type: r.shift_type,
      device: deviceLabel(r.device),
    };
    if (r.started_at) {
      out.push({ ...base, direction: "in", at: r.started_at, lat: r.start_lat, lng: r.start_lng, in_fence: r.start_in_fence, accuracy_m: r.start_accuracy_m });
    }
    if (r.ended_at) {
      out.push({ ...base, direction: "out", at: r.ended_at, lat: r.end_lat, lng: r.end_lng, in_fence: r.end_in_fence, accuracy_m: r.end_accuracy_m });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function punchColumns(tz = DEFAULT_TZ): CsvColumn<PunchRow>[] {
  return [
    { header: "Date", value: (r) => r.shift_date },
    { header: "Guard", value: (r) => r.guard_name },
    { header: "Code", value: (r) => r.employee_code },
    { header: "Site", value: (r) => r.site_name },
    { header: "Shift type", value: (r) => r.shift_type },
    { header: "Punch", value: (r) => (r.direction === "in" ? "Check-in" : "Check-out") },
    { header: "Time", value: (r) => stamp(r.at, tz) },
    { header: "Latitude", value: (r) => num(r.lat, 6) },
    { header: "Longitude", value: (r) => num(r.lng, 6) },
    { header: "In fence", value: (r) => bool(r.in_fence) },
    { header: "Accuracy (m)", value: (r) => num(r.accuracy_m, 1) },
    { header: "Device", value: (r) => r.device },
  ];
}

// ---------------------------------------------------------------------------
// Patrol compliance
// ---------------------------------------------------------------------------

export type PatrolExportRow =
  | ({ kind: "patrol" } & PatrolReportRow)
  | { kind: "summary"; site_name: string; route_name: string; expected: number; completed: number; late: number; missed: number; compliance_pct: number | null };

export type RouteSummary = Extract<PatrolExportRow, { kind: "summary" }>;

/** Per-route rollup: compliance % counts on-time completions against everything that came due. */
export function summarisePatrols(rows: PatrolReportRow[]): RouteSummary[] {
  const by = new Map<string, RouteSummary>();
  for (const r of rows) {
    const key = `${r.site_name}::${r.route_name ?? "—"}`;
    let s = by.get(key);
    if (!s) {
      s = { kind: "summary", site_name: r.site_name, route_name: r.route_name ?? "—", expected: 0, completed: 0, late: 0, missed: 0, compliance_pct: null };
      by.set(key, s);
    }
    s.expected += 1;
    if (r.status === "completed") s.completed += 1;
    else if (r.status === "late") s.late += 1;
    else if (r.status === "missed") s.missed += 1;
  }
  for (const s of by.values()) {
    const due = s.completed + s.late + s.missed;
    s.compliance_pct = due > 0 ? Math.round((1000 * s.completed) / due) / 10 : null;
  }
  return [...by.values()].sort((a, b) => a.site_name.localeCompare(b.site_name) || a.route_name.localeCompare(b.route_name));
}

/** Patrol rows first, then a blank spacer and the per-route summary block. */
export function toPatrolExportRows(rows: PatrolReportRow[]): PatrolExportRow[] {
  return [...rows.map((r) => ({ kind: "patrol" as const, ...r })), ...summarisePatrols(rows)];
}

export function patrolColumns(tz = DEFAULT_TZ): CsvColumn<PatrolExportRow>[] {
  const p = (r: PatrolExportRow) => (r.kind === "patrol" ? r : null);
  return [
    { header: "Row", value: (r) => (r.kind === "patrol" ? "patrol" : "route summary") },
    { header: "Site", value: (r) => r.site_name },
    { header: "Route", value: (r) => r.route_name ?? "" },
    { header: "Guard", value: (r) => p(r)?.guard_name ?? "" },
    { header: "Expected", value: (r) => (r.kind === "patrol" ? stamp(r.expected_at, tz) : String(r.expected)) },
    { header: "Started", value: (r) => (r.kind === "patrol" ? stamp(r.started_at, tz) : String(r.completed)) },
    { header: "Ended", value: (r) => (r.kind === "patrol" ? stamp(r.ended_at, tz) : String(r.late)) },
    { header: "Status", value: (r) => (r.kind === "patrol" ? r.status : `${r.missed} missed`) },
    { header: "Photos", value: (r) => (r.kind === "patrol" ? r.photos : "") },
    { header: "Distance (m)", value: (r) => (r.kind === "patrol" ? num(r.distance_m, 0) : "") },
    { header: "Duration (min)", value: (r) => (r.kind === "patrol" ? num(r.duration_s == null ? null : r.duration_s / 60, 1) : "") },
    { header: "Compliance %", value: (r) => (r.kind === "summary" ? num(r.compliance_pct, 1) : "") },
  ];
}

// ---------------------------------------------------------------------------
// Leave register
// ---------------------------------------------------------------------------

export function leaveColumns(tz = DEFAULT_TZ): CsvColumn<LeaveReportRow>[] {
  return [
    { header: "Guard", value: (r) => r.guard_name },
    { header: "Code", value: (r) => r.employee_code },
    { header: "Site", value: (r) => r.site_name },
    { header: "Type", value: (r) => r.type },
    { header: "From", value: (r) => r.start_date },
    { header: "To", value: (r) => r.end_date },
    { header: "Days", value: (r) => r.days },
    { header: "Status", value: (r) => r.status },
    { header: "Reason", value: (r) => r.reason },
    { header: "Decided by", value: (r) => r.decided_by },
    { header: "Decided at", value: (r) => stamp(r.decided_at, tz) },
    { header: "Requested at", value: (r) => stamp(r.created_at, tz) },
  ];
}

/** Inclusive day count of a leave request. */
export function leaveDays(start: string, end: string) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Attendance analytics: stat tiles + per-site table
// ---------------------------------------------------------------------------

export type ShiftSummary = {
  scheduled: number;
  present: number;
  half_day: number;
  absent: number;
  on_leave: number;
  flagged: number;
  void: number;
  attendance_rate: number | null;
  punctuality_pct: number | null;
  avg_away_min: number;
  flagged_pct: number | null;
  void_pct: number | null;
};

/**
 * One pass over the filtered shift rows for the analytics stat tiles. Everything
 * downstream (per-site table, guard scorecards) reuses this rather than issuing
 * another query per row group.
 */
export function summariseShiftRows(rows: ShiftReportRow[]): ShiftSummary {
  const scheduled = rows.length;
  const present = rows.filter((r) => r.attendance === "present").length;
  const half_day = rows.filter((r) => r.attendance === "half_day").length;
  const absent = rows.filter((r) => r.attendance === "absent").length;
  const on_leave = rows.filter((r) => r.attendance === "on_leave").length;
  const flagged = rows.filter((r) => r.trust === "flagged" || r.trust === "suspicious").length;
  const voidCount = rows.filter((r) => r.status === "void_location_off").length;
  const withAway = rows.filter((r) => r.ended_at);
  const avg_away_min = withAway.length === 0 ? 0 : Math.round((withAway.reduce((a, r) => a + r.away_seconds, 0) / withAway.length / 60) * 10) / 10;
  return {
    scheduled,
    present,
    half_day,
    absent,
    on_leave,
    flagged,
    void: voidCount,
    attendance_rate: attendanceRate({ scheduled, present, half_day, absent, on_leave }),
    punctuality_pct: punctuality(rows),
    avg_away_min,
    flagged_pct: scheduled > 0 ? Math.round((1000 * flagged) / scheduled) / 10 : null,
    void_pct: scheduled > 0 ? Math.round((1000 * voidCount) / scheduled) / 10 : null,
  };
}

export type SiteRangeSummary = ShiftSummary & { site_id: string; site_name: string };

/** Per-site rollup for the analytics table, sharing the same math as the stat tiles. */
export function buildSiteRangeSummary(rows: ShiftReportRow[]): SiteRangeSummary[] {
  const bySite = new Map<string, ShiftReportRow[]>();
  for (const r of rows) {
    const list = bySite.get(r.site_id) ?? [];
    list.push(r);
    bySite.set(r.site_id, list);
  }
  return [...bySite.entries()]
    .map(([site_id, siteRows]) => ({ site_id, site_name: siteRows[0]!.site_name, ...summariseShiftRows(siteRows) }))
    .sort((a, b) => a.site_name.localeCompare(b.site_name));
}

// ---------------------------------------------------------------------------
// Guard scorecards (one aggregate pass, not one RPC call per guard)
// ---------------------------------------------------------------------------

export type PatrolCount = { patrols: number; missed: number };

export type GuardScorecardRow = {
  guard_id: string;
  guard_name: string;
  employee_code: string | null;
  site_name: string;
  shifts: number;
  present: number;
  half_day: number;
  absent: number;
  on_leave: number;
  punctuality_pct: number | null;
  avg_away_min: number;
  flagged: number;
  void: number;
  missed_patrols: number;
  patrols: number;
};

/**
 * Builds one scorecard row per guard from the already-fetched shift rows for the
 * filtered range, plus a guard_id -> patrol counts map from a single patrols query.
 * Mirrors `public.guard_scorecard`'s math so the numbers match the per-guard RPC,
 * without the N+1 round trip the PRD calls out.
 */
export function buildGuardScorecards(rows: ShiftReportRow[], patrolCounts: Map<string, PatrolCount>): GuardScorecardRow[] {
  const byGuard = new Map<string, ShiftReportRow[]>();
  for (const r of rows) {
    const list = byGuard.get(r.guard_id) ?? [];
    list.push(r);
    byGuard.set(r.guard_id, list);
  }
  const out: GuardScorecardRow[] = [];
  for (const [guard_id, guardRows] of byGuard) {
    const s = summariseShiftRows(guardRows);
    const pc = patrolCounts.get(guard_id);
    out.push({
      guard_id,
      guard_name: guardRows[0]!.guard_name,
      employee_code: guardRows[0]!.employee_code,
      site_name: guardRows[0]!.site_name,
      shifts: s.scheduled,
      present: s.present,
      half_day: s.half_day,
      absent: s.absent,
      on_leave: s.on_leave,
      punctuality_pct: s.punctuality_pct,
      avg_away_min: s.avg_away_min,
      flagged: s.flagged,
      void: s.void,
      missed_patrols: pc?.missed ?? 0,
      patrols: pc?.patrols ?? 0,
    });
  }
  return out.sort((a, b) => a.guard_name.localeCompare(b.guard_name));
}

export type ScorecardSortKey = keyof Pick<
  GuardScorecardRow,
  "guard_name" | "site_name" | "shifts" | "punctuality_pct" | "present" | "half_day" | "absent" | "avg_away_min" | "missed_patrols" | "flagged" | "void"
>;

export function sortScorecards(rows: GuardScorecardRow[], key: ScorecardSortKey, dir: "asc" | "desc"): GuardScorecardRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") return sign * String(av).localeCompare(String(bv));
    return sign * ((av as number) - (bv as number));
  });
}

// ---------------------------------------------------------------------------
// Owner daily digest (9 AM)
// ---------------------------------------------------------------------------

export type DigestSite = {
  site_name: string;
  scheduled: number;
  present: number;
  half_day: number;
  absent: number;
  on_leave: number;
  flagged: number;
  pending: number;
};

export type DigestAnomaly = { kind: "late_start" | "void_shift" | "missed_patrol" | "outside_fence"; text: string };

export type Digest = {
  date: string;
  agencyName: string;
  sites: DigestSite[];
  totals: DigestSite;
  anomalies: DigestAnomaly[];
};

export const ANOMALY_LABELS: Record<DigestAnomaly["kind"], string> = {
  late_start: "Late starts",
  void_shift: "Void shifts",
  missed_patrol: "Missed patrols",
  outside_fence: "Outside-fence check-ins",
};

const ANOMALY_EVENT_KIND: Partial<Record<EventType, DigestAnomaly["kind"]>> = {
  LATE_START: "late_start",
  SHIFT_VOID: "void_shift",
  PATROL_MISSED: "missed_patrol",
  OUTSIDE_FENCE: "outside_fence",
};

export type DigestEventRow = { type: EventType; title: string; site_name: string | null };

/** Maps the day's events feed onto the four digest anomaly buckets the PRD asks for. */
export function buildDigestAnomalies(events: DigestEventRow[]): DigestAnomaly[] {
  return events
    .map((e) => {
      const kind = ANOMALY_EVENT_KIND[e.type];
      if (!kind) return null;
      return { kind, text: e.site_name ? `${e.site_name}: ${e.title}` : e.title };
    })
    .filter((a): a is DigestAnomaly => a !== null);
}

export function digestTotals(sites: DigestSite[]): DigestSite {
  return sites.reduce<DigestSite>(
    (a, s) => ({
      site_name: "All sites",
      scheduled: a.scheduled + s.scheduled,
      present: a.present + s.present,
      half_day: a.half_day + s.half_day,
      absent: a.absent + s.absent,
      on_leave: a.on_leave + s.on_leave,
      flagged: a.flagged + s.flagged,
      pending: a.pending + s.pending,
    }),
    { site_name: "All sites", scheduled: 0, present: 0, half_day: 0, absent: 0, on_leave: 0, flagged: 0, pending: 0 },
  );
}

/** Present + half day over everything that was expected to be worked (leave excluded). */
export function attendanceRate(s: Pick<DigestSite, "present" | "half_day" | "absent" | "scheduled" | "on_leave">) {
  const expected = s.scheduled - s.on_leave;
  if (expected <= 0) return null;
  return Math.round((1000 * (s.present + s.half_day)) / expected) / 10;
}

/**
 * The plain-text version an owner receives on WhatsApp. Deliberately narrow —
 * no markdown tables, no emoji, one site per line.
 */
export function buildDigestText(d: Digest, dateLabel = d.date): string {
  const lines: string[] = [];
  lines.push(`${d.agencyName} — attendance digest`);
  lines.push(dateLabel);
  lines.push("");
  const rate = attendanceRate(d.totals);
  lines.push(`Overall: ${d.totals.present + d.totals.half_day}/${Math.max(0, d.totals.scheduled - d.totals.on_leave)} on duty${rate == null ? "" : ` (${rate}%)`}`);
  lines.push("");
  for (const s of d.sites) {
    const bits = [`${s.present} present`];
    if (s.half_day) bits.push(`${s.half_day} half day`);
    if (s.absent) bits.push(`${s.absent} absent`);
    if (s.on_leave) bits.push(`${s.on_leave} on leave`);
    if (s.pending) bits.push(`${s.pending} not started`);
    lines.push(`${s.site_name}: ${bits.join(", ")}`);
  }
  if (d.anomalies.length === 0) {
    lines.push("");
    lines.push("No anomalies.");
  } else {
    for (const kind of Object.keys(ANOMALY_LABELS) as DigestAnomaly["kind"][]) {
      const group = d.anomalies.filter((a) => a.kind === kind);
      if (group.length === 0) continue;
      lines.push("");
      lines.push(`${ANOMALY_LABELS[kind]} (${group.length})`);
      for (const a of group) lines.push(`- ${a.text}`);
    }
  }
  return lines.join("\n");
}
