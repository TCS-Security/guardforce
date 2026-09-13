import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { tallyPatrols, compliancePct, type PatrolTally } from "@/lib/domain/patrols";
import type { PatrolStatus } from "@/lib/supabase/types";

export type PatrolRow = {
  id: string;
  site_id: string;
  route_id: string | null;
  guard_id: string;
  shift_id: string | null;
  expected_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: PatrolStatus;
  distance_m: number | null;
  duration_s: number | null;
  guards: { full_name: string; employee_code: string | null } | null;
  patrol_routes: { name: string; grace_min: number; min_photos: number } | null;
  patrol_photos: { id: string }[];
};

/** Patrol board for one day, grouped by site with compliance per site. */
export async function loadPatrolBoard(session: Session, date: string, siteId: string | null) {
  const supabase = await createClient();
  await supabase.rpc("run_monitors", { p_agency_id: session.agency.id });

  let query = supabase
    .from("patrols")
    .select(
      "id,site_id,route_id,guard_id,shift_id,expected_at,started_at,ended_at,status,distance_m,duration_s,guards(full_name,employee_code),patrol_routes(name,grace_min,min_photos),patrol_photos(id)",
    )
    .gte("expected_at", `${date}T00:00:00+05:30`)
    .lte("expected_at", `${date}T23:59:59+05:30`)
    .order("expected_at");
  if (siteId) query = query.eq("site_id", siteId);

  const [{ data }, { data: sites }] = await Promise.all([
    query,
    supabase.from("sites").select("id,name,patrol_photo_required").eq("is_active", true).order("name"),
  ]);

  const rows = (data ?? []) as unknown as PatrolRow[];
  const bySite = new Map<string, PatrolRow[]>();
  for (const p of rows) bySite.set(p.site_id, [...(bySite.get(p.site_id) ?? []), p]);

  const perSite = (sites ?? [])
    .filter((s) => !siteId || s.id === siteId)
    .map((s) => {
      const list = bySite.get(s.id) ?? [];
      const tally: PatrolTally = tallyPatrols(list);
      return { site: s, patrols: list, tally, compliance: compliancePct(tally) };
    });

  const overall = tallyPatrols(rows);
  return { perSite, sites: sites ?? [], overall, compliance: compliancePct(overall), total: rows.length };
}

export async function loadPatrolRoutes(session: Session) {
  const supabase = await createClient();
  const [{ data: routes }, { data: sites }, { data: shiftTypes }] = await Promise.all([
    supabase.from("patrol_routes").select("*,sites(name,patrol_photo_required),shift_types(name)").order("name"),
    supabase.from("sites").select("id,name,patrol_photo_required").eq("is_active", true).order("name"),
    supabase.from("shift_types").select("id,name,site_id").eq("is_active", true).order("start_time"),
  ]);
  return { routes: routes ?? [], sites: sites ?? [], shiftTypes: shiftTypes ?? [] };
}

export async function loadPatrol(session: Session, patrolId: string) {
  const supabase = await createClient();
  const { data: patrol } = await supabase
    .from("patrols")
    .select(
      "*,guards(id,full_name,employee_code),sites(id,name,lat,lng,fence_type,radius_m,polygon,leeway_m,patrol_photo_required),patrol_routes(name,description,frequency_min,grace_min,min_photos)",
    )
    .eq("id", patrolId)
    .maybeSingle();
  if (!patrol) return null;

  const { data: photos } = await supabase
    .from("patrol_photos")
    .select("id,file_path,lat,lng,taken_at,caption")
    .eq("patrol_id", patrolId)
    .order("taken_at");

  return { patrol, photos: photos ?? [] };
}
