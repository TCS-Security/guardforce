import "server-only";
import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import {
  buildDigestAnomalies,
  buildGuardScorecards,
  type Digest,
  type DigestSite,
  type LeaveReportRow,
  type PatrolCount,
  type PatrolReportRow,
  type ShiftReportRow,
} from "@/lib/domain/reports";
import { digestTotals } from "@/lib/domain/reports";

export type ReportFilters = {
  from: string;
  to: string;
  siteId: string | null;
  guardId: string | null;
};

/** Sites and guards visible to the signed-in user (RLS-scoped), for the filter bar selects. */
export async function loadFilterOptions() {
  const supabase = await createClient();
  const [{ data: sites }, { data: guards }] = await Promise.all([
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
    supabase.from("guards").select("id,full_name,employee_code,site_id").neq("status", "inactive").order("full_name"),
  ]);
  return { sites: sites ?? [], guards: guards ?? [] };
}

/** Shifts joined with guard/site/shift-type names, shaped for the report/CSV builders. */
export async function loadShiftReportRows(filters: ReportFilters): Promise<ShiftReportRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("shifts")
    .select(
      "id,shift_date,guard_id,site_id,scheduled_start,scheduled_end,started_at,ended_at,start_lat,start_lng,start_in_fence,start_accuracy_m,end_lat,end_lng,end_in_fence,end_accuracy_m,late_by_min,worked_minutes,away_seconds,attendance,status,trust,flags,device,guards(full_name,employee_code),sites(name),shift_types(name)",
    )
    .gte("shift_date", filters.from)
    .lte("shift_date", filters.to)
    .order("shift_date", { ascending: true });
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  if (filters.guardId) q = q.eq("guard_id", filters.guardId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    shift_date: r.shift_date,
    guard_id: r.guard_id,
    guard_name: r.guards?.full_name ?? "—",
    employee_code: r.guards?.employee_code ?? null,
    site_id: r.site_id,
    site_name: r.sites?.name ?? "—",
    shift_type: r.shift_types?.name ?? null,
    scheduled_start: r.scheduled_start,
    scheduled_end: r.scheduled_end,
    started_at: r.started_at,
    ended_at: r.ended_at,
    start_lat: r.start_lat,
    start_lng: r.start_lng,
    start_in_fence: r.start_in_fence,
    start_accuracy_m: r.start_accuracy_m,
    end_lat: r.end_lat,
    end_lng: r.end_lng,
    end_in_fence: r.end_in_fence,
    end_accuracy_m: r.end_accuracy_m,
    late_by_min: r.late_by_min,
    worked_minutes: r.worked_minutes,
    away_seconds: r.away_seconds,
    attendance: r.attendance,
    status: r.status,
    trust: r.trust,
    flags: r.flags,
    device: r.device as Record<string, unknown> | null,
  }));
}

/** Patrols joined with guard/site/route names for the compliance report. */
export async function loadPatrolReportRows(filters: Pick<ReportFilters, "from" | "to" | "siteId">): Promise<PatrolReportRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("patrols")
    .select("id,expected_at,started_at,ended_at,status,distance_m,duration_s,guards(full_name),sites(name),patrol_routes(name),patrol_photos(id)")
    .gte("expected_at", `${filters.from}T00:00:00Z`)
    .lte("expected_at", `${filters.to}T23:59:59Z`)
    .order("expected_at", { ascending: true });
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    site_name: r.sites?.name ?? "—",
    route_name: r.patrol_routes?.name ?? null,
    guard_name: r.guards?.full_name ?? "—",
    expected_at: r.expected_at,
    started_at: r.started_at,
    ended_at: r.ended_at,
    status: r.status,
    photos: r.patrol_photos?.length ?? 0,
    distance_m: r.distance_m,
    duration_s: r.duration_s,
  }));
}

/** Guard id -> patrol totals for the range, one query (not one per guard). */
export async function loadPatrolCounts(filters: Pick<ReportFilters, "from" | "to" | "siteId">): Promise<Map<string, PatrolCount>> {
  const supabase = await createClient();
  let q = supabase
    .from("patrols")
    .select("guard_id,status")
    .gte("expected_at", `${filters.from}T00:00:00Z`)
    .lte("expected_at", `${filters.to}T23:59:59Z`);
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  const { data, error } = await q;
  if (error) throw error;
  const out = new Map<string, PatrolCount>();
  for (const r of data ?? []) {
    const c = out.get(r.guard_id) ?? { patrols: 0, missed: 0 };
    c.patrols += 1;
    if (r.status === "missed") c.missed += 1;
    out.set(r.guard_id, c);
  }
  return out;
}

/** Guard scorecards for the filtered range: one shifts query + one patrols query, aggregated in JS. */
export async function loadGuardScorecards(filters: ReportFilters) {
  const [rows, patrolCounts] = await Promise.all([loadShiftReportRows(filters), loadPatrolCounts(filters)]);
  return buildGuardScorecards(rows, patrolCounts);
}

/** Leave requests joined with guard/site/decider names for the leave register. */
export async function loadLeaveReportRows(filters: Pick<ReportFilters, "from" | "to" | "siteId">): Promise<LeaveReportRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("leave_requests")
    .select("id,type,start_date,end_date,reason,status,decided_at,created_at,guards(full_name,employee_code),sites(name),profiles(full_name)")
    .gte("start_date", filters.from)
    .lte("start_date", filters.to)
    .order("start_date", { ascending: true });
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    guard_name: r.guards?.full_name ?? "—",
    employee_code: r.guards?.employee_code ?? null,
    site_name: r.sites?.name ?? "—",
    type: r.type,
    start_date: r.start_date,
    end_date: r.end_date,
    days: Math.round((new Date(`${r.end_date}T00:00:00Z`).getTime() - new Date(`${r.start_date}T00:00:00Z`).getTime()) / 86_400_000) + 1,
    status: r.status,
    reason: r.reason,
    decided_by: r.profiles?.full_name ?? null,
    decided_at: r.decided_at,
    created_at: r.created_at,
  }));
}

/** Muster roll rows: shifts for a whole month at a site (or every accessible site). */
export async function loadMusterRows(filters: { from: string; to: string; siteId: string | null }): Promise<ShiftReportRow[]> {
  return loadShiftReportRows({ ...filters, guardId: null });
}

/** The 9 AM owner digest for a given date: per-site summary (site_day_summary RPC) + anomaly events. */
export async function loadDigest(session: Session, date: string): Promise<Digest> {
  const supabase = await createClient();
  const tz = session.agency.timezone;
  const dayStart = fromZonedTime(`${date}T00:00:00`, tz).toISOString();
  const dayEnd = fromZonedTime(`${date}T23:59:59.999`, tz).toISOString();

  const [{ data: summary }, { data: events }] = await Promise.all([
    supabase.rpc("site_day_summary", { p_agency_id: session.agency.id, p_date: date }),
    supabase
      .from("events")
      .select("type,title,created_at,sites(name)")
      .in("type", ["LATE_START", "SHIFT_VOID", "PATROL_MISSED", "OUTSIDE_FENCE"])
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true }),
  ]);

  const sites: DigestSite[] = (summary ?? []).map((s) => ({
    site_name: s.site_name,
    scheduled: s.scheduled,
    present: s.present,
    half_day: s.half_day,
    absent: s.absent,
    on_leave: s.on_leave,
    flagged: s.flagged,
    pending: s.pending,
  }));
  const anomalies = buildDigestAnomalies((events ?? []).map((e) => ({ type: e.type, title: e.title, site_name: e.sites?.name ?? null })));

  return { date, agencyName: session.agency.name, sites, totals: digestTotals(sites), anomalies };
}
