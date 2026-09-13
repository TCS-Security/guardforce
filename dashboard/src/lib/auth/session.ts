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
    supabase.from("profiles").select("*, agencies(*)").eq("id", user.id).maybeSingle(),
    supabase.from("sites").select("id").eq("is_active", true).order("name"),
  ]);

  if (profileError) {
    // A transient read failure (clock skew on the JWT, a database blip) must not look
    // like "this account has no profile" — signing the user out would hide the fault.
    throw new Error(`Could not load your profile: ${profileError.message}`);
  }
  if (!profile) {
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
