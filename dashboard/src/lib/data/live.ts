import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";

export type LivePresence = {
  guard_id: string;
  site_id: string | null;
  shift_id: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  battery_pct: number | null;
  in_fence: boolean | null;
  is_mock: boolean;
  location_enabled: boolean;
  last_seen_at: string | null;
  guards: { id: string; full_name: string; employee_code: string | null; designation: string | null; phone: string } | null;
  shifts: { id: string; started_at: string | null; scheduled_end: string | null; shift_types: { name: string } | null } | null;
};

export type LiveSite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  fence_type: "radius" | "polygon";
  radius_m: number;
  polygon: unknown;
  leeway_m: number;
  guards_required: number;
};

/** Live map payload: every accessible site's fence plus the guards currently on duty. */
export async function loadLive(session: Session) {
  const supabase = await createClient();
  await supabase.rpc("run_monitors", { p_agency_id: session.agency.id });

  const [sites, presence] = await Promise.all([
    supabase
      .from("sites")
      .select("id,name,lat,lng,fence_type,radius_m,polygon,leeway_m,guards_required")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("guard_presence")
      .select(
        "guard_id,site_id,shift_id,lat,lng,accuracy_m,battery_pct,in_fence,is_mock,location_enabled,last_seen_at,guards(id,full_name,employee_code,designation,phone),shifts(id,started_at,scheduled_end,shift_types(name))",
      )
      .not("shift_id", "is", null),
  ]);

  return {
    sites: (sites.data ?? []) as LiveSite[],
    presence: (presence.data ?? []) as unknown as LivePresence[],
  };
}
