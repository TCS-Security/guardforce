import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { signOut } from "../login/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

/** Shown to members of a suspended tenant. RLS already returns nothing for them. */
export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("agencies(name,status,suspended_reason)").eq("id", user.id).maybeSingle();
  const agency = data?.agencies as { name: string; status: string; suspended_reason: string | null } | null | undefined;
  if (!agency || (agency.status !== "suspended" && agency.status !== "churned")) redirect("/");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center">
        <ShieldOff className="mx-auto size-8 text-muted-foreground" />
        <div className="eyebrow mt-5">{agency.name}</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
          {agency.status === "churned" ? "This account has been closed" : "This account is suspended"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {agency.suspended_reason ?? "Access to the dashboard has been paused by GuardForce. Your data is safe and nothing has been deleted."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Contact GuardForce support to restore access.</p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
