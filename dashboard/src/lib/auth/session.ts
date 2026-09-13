import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency, Profile } from "@/lib/supabase/types";

export type Session = {
  userId: string;
  profile: Profile;
  agency: Agency;
  /** Site ids visible to this user (all sites for owner/admin). */
  siteIds: string[];
  isOwner: boolean;
  isManager: boolean;
};

/** Loads the signed-in user's profile, agency and site scope. Redirects to /login when signed out. */
export const requireSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile, error: profileError }, { data: sites }] = await Promise.all([
    supabase.from("profiles").select("*, agencies(*)").eq("id", user.id).single(),
    supabase.from("sites").select("id").eq("is_active", true).order("name"),
  ]);
  if (!profile) {
    console.error("requireSession: no profile for user", user.id, profileError?.message);
    await supabase.auth.signOut();
    redirect("/login?error=no-profile");
  }
  const { agencies: agency, ...rest } = profile as Profile & { agencies: Agency };
  return {
    userId: user.id,
    profile: rest,
    agency,
    siteIds: (sites ?? []).map((s) => s.id),
    isOwner: rest.role === "owner" || rest.role === "admin",
    isManager: rest.role !== "guard",
  };
});
