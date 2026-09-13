import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";

export type SiteListRow = {
  id: string;
  name: string;
  client_name: string | null;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  fence_type: "radius" | "polygon";
  radius_m: number;
  leeway_m: number;
  polygon: unknown;
  guards_required: number;
  patrol_photo_required: boolean;
  is_active: boolean;
  supervisors: { id: string; full_name: string }[];
  on_duty_now: number;
  present: number;
  absent: number;
  flagged: number;
  scheduled: number;
  guards_count: number;
};

/** Site list with today's staffing folded in (site_day_summary covers active sites only). */
export async function loadSites(session: Session, opts: { includeInactive?: boolean } = {}) {
  const supabase = await createClient();
  const today = toLocalDate(new Date(), session.agency.timezone);

  const [sitesRes, summaryRes, supRes, guardCountRes] = await Promise.all([
    supabase
      .from("sites")
      .select("id,name,client_name,city,address,lat,lng,fence_type,radius_m,leeway_m,polygon,guards_required,patrol_photo_required,is_active")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase.rpc("site_day_summary", { p_agency_id: session.agency.id, p_date: today }),
    supabase.from("supervisor_sites").select("site_id,profiles(id,full_name)"),
    supabase.from("guards").select("id,site_id").neq("status", "inactive"),
  ]);

  const summary = new Map((summaryRes.data ?? []).map((s) => [s.site_id, s]));
  const sups = new Map<string, { id: string; full_name: string }[]>();
  for (const row of supRes.data ?? []) {
    const p = row.profiles as unknown as { id: string; full_name: string } | null;
    if (!p) continue;
    sups.set(row.site_id, [...(sups.get(row.site_id) ?? []), p]);
  }
  const guardCounts = new Map<string, number>();
  for (const g of guardCountRes.data ?? []) {
    if (g.site_id) guardCounts.set(g.site_id, (guardCounts.get(g.site_id) ?? 0) + 1);
  }

  const rows: SiteListRow[] = (sitesRes.data ?? [])
    .filter((s) => opts.includeInactive || s.is_active)
    .map((s) => {
      const sum = summary.get(s.id);
      return {
        ...s,
        supervisors: sups.get(s.id) ?? [],
        on_duty_now: sum?.on_duty_now ?? 0,
        present: sum?.present ?? 0,
        absent: sum?.absent ?? 0,
        flagged: sum?.flagged ?? 0,
        scheduled: sum?.scheduled ?? 0,
        guards_count: guardCounts.get(s.id) ?? 0,
      } as SiteListRow;
    });

  return rows;
}

/** Everything the site detail page needs, in one round trip set. */
export async function loadSite(session: Session, siteId: string) {
  const supabase = await createClient();
  const today = toLocalDate(new Date(), session.agency.timezone);

  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

  const [shiftTypes, shifts, presence, supervisors, allSupervisors, routes, guards] = await Promise.all([
    supabase.from("shift_types").select("*").eq("site_id", siteId).order("start_time"),
    supabase
      .from("shifts")
      .select("id,guard_id,shift_type_id,status,attendance,trust,flags,started_at,ended_at,scheduled_start,scheduled_end,late_by_min,away_seconds,guards(id,full_name,employee_code)")
      .eq("site_id", siteId)
      .eq("shift_date", today)
      .order("scheduled_start"),
    supabase
      .from("guard_presence")
      .select("guard_id,lat,lng,battery_pct,in_fence,last_seen_at,location_enabled,shift_id,guards(full_name,employee_code)")
      .eq("site_id", siteId)
      .not("shift_id", "is", null),
    supabase.from("supervisor_sites").select("profile_id,profiles(id,full_name,email)").eq("site_id", siteId),
    supabase.from("profiles").select("id,full_name,email,role").in("role", ["supervisor", "admin"]).eq("is_active", true).order("full_name"),
    supabase.from("patrol_routes").select("*").eq("site_id", siteId).order("name"),
    supabase.from("guards").select("id,full_name,employee_code,designation,status").eq("site_id", siteId).neq("status", "inactive").order("full_name"),
  ]);

  return {
    site,
    shiftTypes: shiftTypes.data ?? [],
    shifts: shifts.data ?? [],
    presence: presence.data ?? [],
    supervisors: (supervisors.data ?? []).map((r) => r.profiles as unknown as { id: string; full_name: string; email: string | null }).filter(Boolean),
    allSupervisors: allSupervisors.data ?? [],
    routes: routes.data ?? [],
    guards: guards.data ?? [],
    today,
  };
}

export type SiteDetail = NonNullable<Awaited<ReturnType<typeof loadSite>>>;

/** Shift types that already have roster rows — deleting them would orphan history. */
export async function shiftTypeUsage(siteId: string) {
  const supabase = await createClient();
  const [assignments, patterns] = await Promise.all([
    supabase.from("shift_assignments").select("shift_type_id").eq("site_id", siteId),
    supabase.from("roster_patterns").select("shift_type_id").eq("site_id", siteId),
  ]);
  const used = new Map<string, number>();
  for (const r of [...(assignments.data ?? []), ...(patterns.data ?? [])]) {
    used.set(r.shift_type_id, (used.get(r.shift_type_id) ?? 0) + 1);
  }
  return used;
}
