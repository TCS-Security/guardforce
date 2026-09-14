import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";

export type PlatformAdmin = Tables<"platform_admins">;

/** The signed-in user's platform_admins row, or null. Cheap: reads their own row under RLS. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("platform_admins").select("*").eq("user_id", user.id).maybeSingle();
  return data ?? null;
});

/**
 * Gate for /platform. Platform admins are not tenant members, so everything they do runs
 * through the service-role client after this check — there is no tenant scope to apply.
 */
export const requirePlatformAdmin = cache(async () => {
  const admin = await getPlatformAdmin();
  if (!admin) {
    // Signed-in tenant members go back to their own dashboard; everyone else to login.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    redirect(user ? "/" : "/login?error=not-platform");
  }
  return { admin, db: createAdminClient() };
});
