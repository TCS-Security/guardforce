import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { AgencyForm } from "./agency-form";

export const metadata: Metadata = { title: "Settings — Agency" };
export const dynamic = "force-dynamic";

export default async function AgencySettingsPage() {
  const session = await requireSession();
  return <AgencyForm agency={session.agency} editable={session.isOwner} />;
}
