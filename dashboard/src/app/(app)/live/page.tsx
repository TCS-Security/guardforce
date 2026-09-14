import type { Metadata } from "next";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadLive } from "@/lib/data/live";
import { LiveBoard } from "@/components/live/live-board";

export const metadata: Metadata = { title: "Live map" };
export const dynamic = "force-dynamic";

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  const session = await requireSession();
  requirePermission(session, "live:read");
  const sp = await searchParams;
  const { sites, presence } = await loadLive(session);
  const siteId = typeof sp.site === "string" && sites.some((s) => s.id === sp.site) ? sp.site : null;

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
      <LiveBoard
        sites={sites}
        initialPresence={presence}
        stalenessMin={session.agency.staleness_min}
        timezone={session.agency.timezone}
        initialSiteId={siteId}
      />
    </div>
  );
}
