import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  status: "trial" | "active" | "suspended" | "churned";
  plan: string;
  max_guards: number | null;
  created_at: string;
  suspended_at: string | null;
  guards: number;
  sites: number;
  members: number;
  last_activity: string | null;
};

/** Every tenant with the numbers a provider watches: seats, sites, people, last activity. */
export async function loadTenants(db: Db): Promise<TenantRow[]> {
  const [{ data: agencies }, { data: guards }, { data: sites }, { data: profiles }, { data: events }] = await Promise.all([
    db.from("agencies").select("id,name,slug,city,status,plan,max_guards,created_at,suspended_at").order("created_at", { ascending: false }),
    db.from("guards").select("agency_id").neq("status", "inactive"),
    db.from("sites").select("agency_id").eq("is_active", true),
    db.from("profiles").select("agency_id").neq("role", "guard").eq("is_active", true),
    db.from("events").select("agency_id,created_at").order("created_at", { ascending: false }).limit(2000),
  ]);

  const count = (rows: { agency_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.agency_id, (m.get(r.agency_id) ?? 0) + 1);
    return m;
  };
  const g = count(guards), s = count(sites), p = count(profiles);
  const last = new Map<string, string>();
  for (const e of events ?? []) if (!last.has(e.agency_id)) last.set(e.agency_id, e.created_at);

  return (agencies ?? []).map((a) => ({
    ...a,
    guards: g.get(a.id) ?? 0,
    sites: s.get(a.id) ?? 0,
    members: p.get(a.id) ?? 0,
    last_activity: last.get(a.id) ?? null,
  }));
}

export async function loadTenant(db: Db, id: string) {
  const { data: agency } = await db.from("agencies").select("*").eq("id", id).maybeSingle();
  if (!agency) return null;

  const [{ data: members }, { data: sites }, { count: guards }, { data: audit }, { count: shifts30 }] = await Promise.all([
    db.from("profiles").select("id,full_name,email,role,is_active,all_sites,roles(name)").eq("agency_id", id).neq("role", "guard").order("role").order("full_name"),
    db.from("sites").select("id,name,city,is_active,guards_required").eq("agency_id", id).order("name"),
    db.from("guards").select("id", { count: "exact", head: true }).eq("agency_id", id).neq("status", "inactive"),
    db.from("audit_logs").select("id,action,reason,created_at,platform_actor_id,profiles(full_name)").eq("agency_id", id).in("entity_type", ["agency", "profile"]).order("created_at", { ascending: false }).limit(20),
    db.from("shifts").select("id", { count: "exact", head: true }).eq("agency_id", id).gte("shift_date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  return {
    agency,
    members: (members ?? []).map((m) => ({ ...m, role_name: (m.roles as { name: string } | null)?.name ?? null })),
    sites: sites ?? [],
    guards: guards ?? 0,
    shifts30: shifts30 ?? 0,
    audit: audit ?? [],
  };
}
