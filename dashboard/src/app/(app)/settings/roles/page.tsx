import type { Metadata } from "next";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RolesPanel } from "@/components/roles/roles-panel";

export const metadata: Metadata = { title: "Roles · Settings" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await requireSession();
  requirePermission(session, "team:read");

  const supabase = await createClient();
  const [{ data: roles }, { data: profiles }] = await Promise.all([
    supabase.from("roles").select("id,name,description,is_system,system_key,permissions").order("is_system", { ascending: false }).order("name"),
    supabase.from("profiles").select("role_id").eq("is_active", true),
  ]);
  const members: Record<string, number> = {};
  for (const p of profiles ?? []) if (p.role_id) members[p.role_id] = (members[p.role_id] ?? 0) + 1;

  // Owner first, then the other built-ins, then custom roles.
  const order = { owner: 0, manager: 1, supervisor: 2, viewer: 3 } as Record<string, number>;
  const sorted = [...(roles ?? [])].sort((a, b) => (order[a.system_key ?? ""] ?? 9) - (order[b.system_key ?? ""] ?? 9) || a.name.localeCompare(b.name));

  return <RolesPanel roles={sorted} members={members} canEdit={session.can("team:manage")} />;
}
