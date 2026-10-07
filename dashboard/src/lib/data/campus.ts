import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";
import { buildCampus } from "@/lib/campus/sample";

export type CampusSiteOption = { id: string; name: string; client_name: string | null };

/**
 * The gate & campus preview runs on one of the user's real sites (picked with `?site=`, else
 * the first in scope) and the real guards and presence under RLS. The property around them —
 * towers, tenants, visitors, passes — is sample data until those tables ship.
 */
export async function loadCampus(session: Session, siteParam?: string | null) {
  const supabase = await createClient();
  const [{ data: sites }, { data: guards }, { data: presence }] = await Promise.all([
    // The busiest site first: a campus with the most posts is the most campus-like default.
    supabase.from("sites").select("id,name,client_name,address,city,lat,lng").eq("is_active", true).order("guards_required", { ascending: false }).order("name"),
    supabase.from("guards").select("id,full_name,employee_code,phone,site_id").neq("status", "inactive").order("full_name"),
    supabase.from("guard_presence").select("guard_id,battery_pct,last_seen_at,shift_id"),
  ]);
  const options: CampusSiteOption[] = (sites ?? []).map(({ id, name, client_name }) => ({ id, name, client_name }));
  const site = (sites ?? []).find((s) => s.id === siteParam) ?? sites?.[0];
  if (!site) return { sites: options, data: null, shifted: false };

  // This site's guards first, then the rest of the scope, so a thin site still has a crew.
  const all = guards ?? [];
  const crew = [...all.filter((g) => g.site_id === site.id), ...all.filter((g) => g.site_id !== site.id)].map(({ site_id: _s, ...g }) => g);
  const real = new Date();
  const now = demoClock(real, session.agency.timezone);
  const data = buildCampus(site, crew, presence ?? [], now, toLocalDate(now, session.agency.timezone));
  return { sites: options, data, shifted: now.getTime() !== real.getTime() };
}

/**
 * A gate is quiet at night, so a demo opened after hours would show an empty day. Outside
 * 08:00–20:00 the sample day is shown as of 15:00 the same day; the screens tick forward from
 * whatever clock they were handed, so timers stay consistent.
 */
export function demoClock(now: Date, tz: string): Date {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(now));
  if (hour >= 8 && hour < 20) return now;
  return new Date(`${toLocalDate(now, tz)}T15:00:00+05:30`);
}
