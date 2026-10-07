import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";
import type { Crew } from "@/lib/preview/crew";

/**
 * Active guards and sites in the user's scope, for the preview modules (alertness,
 * overtime, payroll, cashbook, …) whose own tables do not exist yet. Their rows are
 * generated from this crew so names, sites and links are real.
 */
export async function loadPreviewCrew(session: Session): Promise<Crew> {
  const supabase = await createClient();
  const [{ data: guards }, { data: sites }] = await Promise.all([
    supabase.from("guards").select("id,full_name,employee_code,phone,site_id,sites(name)").neq("status", "inactive").order("full_name"),
    supabase.from("sites").select("id,name,client_name,city,guards_required").eq("is_active", true).order("name"),
  ]);
  return {
    guards: (guards ?? []).map(({ sites: s, ...g }) => ({ ...g, site_name: (s as { name: string } | null)?.name ?? null })),
    sites: sites ?? [],
    today: toLocalDate(new Date(), session.agency.timezone),
  };
}
