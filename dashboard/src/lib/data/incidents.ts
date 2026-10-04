import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import type { IncidentSeverity, IncidentStatus, IncidentType, ShiftStatus } from "@/lib/supabase/types";
import type { IncidentFilters } from "@/lib/domain/incidents";

const LIST_SELECT =
  "id,site_id,type,severity,title,description,occurred_at,status,lat,lng,guard_id,reported_by,resolved_at,created_at," +
  "sites(id,name),guards!incidents_guard_id_fkey(id,full_name),profiles!incidents_reported_by_fkey(id,full_name)";

export type IncidentRow = {
  id: string;
  site_id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  occurred_at: string;
  status: IncidentStatus;
  lat: number | null;
  lng: number | null;
  guard_id: string | null;
  reported_by: string | null;
  resolved_at: string | null;
  created_at: string;
  sites: { id: string; name: string } | null;
  guards: { id: string; full_name: string } | null;
  profiles: { id: string; full_name: string } | null;
};

/** The incident log for the filter bar. Site scope is enforced by RLS, not here. */
export async function loadIncidents(session: Session, filters: IncidentFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("incidents")
    .select(LIST_SELECT)
    .gte("occurred_at", `${filters.from}T00:00:00+05:30`)
    .lte("occurred_at", `${filters.to}T23:59:59+05:30`)
    .order("occurred_at", { ascending: false })
    .limit(300);

  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.type) query = query.eq("type", filters.type as IncidentType);
  if (filters.severity) query = query.eq("severity", filters.severity as IncidentSeverity);
  if (filters.status === "unresolved") query = query.neq("status", "resolved");
  else if (filters.status) query = query.eq("status", filters.status as IncidentStatus);

  const [{ data, error }, { data: sites }, { data: guards }] = await Promise.all([
    query,
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
    supabase.from("guards").select("id,full_name,site_id").neq("status", "inactive").order("full_name"),
  ]);
  if (error) throw new Error(`Could not load incidents: ${error.message}`);

  return { rows: (data ?? []) as unknown as IncidentRow[], sites: sites ?? [], guards: guards ?? [] };
}

export type IncidentDetail = IncidentRow & {
  resolution: string | null;
  resolved_by: string | null;
  updated_at: string;
  sites:
    | ({ id: string; name: string } & {
        lat: number;
        lng: number;
        fence_type: "radius" | "polygon";
        radius_m: number;
        polygon: unknown;
        leeway_m: number;
      })
    | null;
  reported_by_guard: { id: string; full_name: string } | null;
  resolver: { id: string; full_name: string } | null;
};

export async function loadIncident(session: Session, id: string): Promise<IncidentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incidents")
    .select(
      "*,sites(id,name,lat,lng,fence_type,radius_m,polygon,leeway_m)," +
        "guards!incidents_guard_id_fkey(id,full_name)," +
        "reported_by_guard:guards!incidents_reported_by_guard_id_fkey(id,full_name)," +
        "profiles!incidents_reported_by_fkey(id,full_name)," +
        "resolver:profiles!incidents_resolved_by_fkey(id,full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as IncidentDetail) ?? null;
}

export type IncidentPosition = {
  guard_id: string;
  guard_name: string;
  employee_code: string | null;
  site_id: string;
  site_name: string;
  same_site: boolean;
  shift_id: string;
  shift_status: ShiftStatus;
  shift_name: string | null;
  lat: number | null;
  lng: number | null;
  source: "ping" | "presence" | "check_in" | "none";
  recorded_at: string | null;
  gap_seconds: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  in_fence: boolean | null;
  location_enabled: boolean | null;
  stale: boolean;
};

/**
 * Where everyone was when it happened — the question the module exists for. The SQL does
 * the reconstruction (nearest ping, then presence, then the check-in point); this only
 * hands it to the page.
 */
export async function loadIncidentPositions(session: Session, incidentId: string): Promise<IncidentPosition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_guard_positions", { p_incident_id: incidentId });
  if (error) {
    // FORBIDDEN means the reader lost site scope between the page load and this call;
    // an empty list reads better than a crash on a page they can otherwise see.
    if (error.message.includes("FORBIDDEN")) return [];
    throw new Error(`Could not reconstruct guard positions: ${error.message}`);
  }
  return (data ?? []) as unknown as IncidentPosition[];
}
