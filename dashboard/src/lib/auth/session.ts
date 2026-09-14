import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, Profile, Tables } from "@/lib/supabase/types";
import { PERMISSION_KEYS, type PermissionKey } from "./permissions";

export type SessionRole = Pick<Tables<"roles">, "id" | "name" | "is_system" | "system_key">;

export type Session = {
  userId: string;
  profile: Profile;
  agency: Agency;
  role: SessionRole | null;
  /** Site ids visible to this user (every active site when all_sites is set). */
  siteIds: string[];
  /** Permission keys this user holds. Owners hold all of them. */
  permissions: ReadonlySet<PermissionKey>;
  can: (key: PermissionKey) => boolean;
  /** Owner kind: full control, cannot be locked out by a role. */
  isOwner: boolean;
  /** Any dashboard user, as opposed to a guard signed in through the app. */
  isManager: boolean;
};

/** Loads the signed-in user's profile, agency, role and site scope. Redirects when signed out. */
export const requireSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile, error: profileError }, { data: sites }, { data: permissionRows }] = await Promise.all([
    supabase.from("profiles").select("*, agencies(*), roles(id,name,is_system,system_key)").eq("id", user.id).maybeSingle(),
    supabase.from("sites").select("id").eq("is_active", true).order("name"),
    supabase.rpc("current_permissions"),
  ]);

  if (profileError) {
    // A transient read failure (clock skew on the JWT, a database blip) must not look
    // like "this account has no profile" — signing the user out would hide the fault.
    throw new Error(`Could not load your profile: ${profileError.message}`);
  }
  if (!profile) {
    // Not visible under RLS. Either this is our own platform staff, the tenant is suspended,
    // or the account really has no profile. Only the last one deserves a sign-out.
    await routeProfilelessUser(user.id, supabase);
  }

  const { agencies: agency, roles: role, ...rest } = profile as Profile & { agencies: Agency; roles: SessionRole | null };
  const permissions = new Set<PermissionKey>(
    ((permissionRows as string[] | null) ?? []).filter((k): k is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(k)),
  );

  return {
    userId: user.id,
    profile: rest,
    agency,
    role,
    siteIds: (sites ?? []).map((s) => s.id),
    permissions,
    can: (key) => permissions.has(key),
    isOwner: rest.role === "owner",
    isManager: rest.role !== "guard",
  };
});

async function routeProfilelessUser(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<never> {
  const admin = createAdminClient();
  const [{ data: platform }, { data: hidden }] = await Promise.all([
    admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("is_active, agencies(status,name)").eq("id", userId).maybeSingle(),
  ]);
  if (platform) redirect("/platform");
  const agency = hidden?.agencies as { status: string; name: string } | null | undefined;
  if (hidden && agency && (agency.status === "suspended" || agency.status === "churned")) redirect("/suspended");
  if (hidden && !hidden.is_active) redirect("/login?error=disabled");
  await supabase.auth.signOut();
  redirect("/login?error=no-profile");
}

/**
 * Page guard. A user without the permission gets a 404 rather than a hint that the page
 * exists — the nav already hides what they cannot open.
 */
export function requirePermission(session: Session, key: PermissionKey) {
  if (!session.can(key)) notFound();
}

/** Action guard: returns the error object the form expects, or null when allowed. */
export function deny(session: Session, key: PermissionKey): { error: string } | null {
  if (session.can(key)) return null;
  return { error: `You don't have permission to do that (${key.replace(":", " · ")}). Ask an owner to update your role.` };
}
