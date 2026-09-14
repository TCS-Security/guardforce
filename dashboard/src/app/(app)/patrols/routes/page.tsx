import type { Metadata } from "next";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPatrolRoutes } from "@/lib/data/patrols";
import { PageHeader } from "@/components/gf/page-header";
import { ButtonLink } from "@/components/gf/button-link";
import { RoutesPanel } from "@/components/patrols/routes-panel";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Patrol routes" };
export const dynamic = "force-dynamic";

export default async function PatrolRoutesPage() {
  const session = await requireSession();
  requirePermission(session, "patrols:read");
  const { routes, sites, shiftTypes } = await loadPatrolRoutes(session);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <PageHeader
        eyebrow="Patrols"
        title="Patrol routes"
        description="What each site's guards must walk, how often, and how much photo proof to bring back."
        actions={
          <ButtonLink href="/patrols" variant="outline" size="sm">
            <ArrowLeft data-icon="inline-start" /> Board
          </ButtonLink>
        }
      />
      <RoutesPanel routes={routes} sites={sites} shiftTypes={shiftTypes} canEdit={session.can("patrols:write")} />
    </div>
  );
}
