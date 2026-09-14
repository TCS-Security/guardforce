import type { Metadata } from "next";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { AgencyForm } from "./agency-form";

export const metadata: Metadata = { title: "Settings — Agency" };
export const dynamic = "force-dynamic";

export default async function AgencySettingsPage() {
  const session = await requireSession();
  requirePermission(session, "settings:read");
  return <AgencyForm agency={session.agency} editable={session.can("settings:write")} />;
}
