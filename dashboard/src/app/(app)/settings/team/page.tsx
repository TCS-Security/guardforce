import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadTeam } from "@/lib/data/settings";
import { TeamPanel } from "./team-panel";

export const metadata: Metadata = { title: "Team · Settings" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await requireSession();
  requirePermission(session, "team:read");
  const { team, sites, roles } = await loadTeam(session);
  return <TeamPanel team={team} sites={sites} roles={roles} canEdit={session.can("team:manage")} currentUserId={session.userId} />;
}
