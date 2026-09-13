import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { loadTeam } from "@/lib/data/settings";
import { TeamPanel } from "./team-panel";

export const metadata: Metadata = { title: "Team · Settings" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await requireSession();
  if (!session.isManager) notFound();
  const { team, sites } = await loadTeam(session);
  return <TeamPanel team={team} sites={sites} canEdit={session.isOwner} currentUserId={session.userId} />;
}
