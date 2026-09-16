import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadRosterSites, loadRosterWeek } from "@/lib/data/roster";
import { PageHeader } from "@/components/gf/page-header";
import { EmptyState } from "@/components/gf/empty-state";
import { RosterBoard } from "@/components/roster/roster-board";
import { RosterToolbar } from "@/components/roster/roster-toolbar";
import { PatternsPanel } from "@/components/roster/patterns-panel";
import { toLocalDate } from "@/lib/domain/format";
import { weekDays } from "@/lib/domain/roster";

export const metadata: Metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: PageProps<"/roster">) {
  const session = await requireSession();
  requirePermission(session, "roster:read");
  const sp = await searchParams;
  const sites = await loadRosterSites(session);
  if (sites.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Operate" title="Roster" />
        <EmptyState className="mt-6" title="No sites yet" description="Add a site before building a roster." />
      </div>
    );
  }

  const siteId = typeof sp.site === "string" && sites.some((s) => s.id === sp.site) ? sp.site : sites[0]!.id;
  const weekParam = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : null;
  const anchor = weekParam ? new Date(`${weekParam}T12:00:00`) : new Date();

  const data = await loadRosterWeek(session, siteId, anchor);
  if (!data.site) notFound();

  const today = toLocalDate(new Date(), session.agency.timezone);
  const days = weekDays(anchor);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <PageHeader
        eyebrow={`${data.site.name} · week of ${days[0]}`}
        title="Roster"
        description="Assign guards to shifts across the week."
      />

      <RosterToolbar sites={sites} siteId={siteId} days={days} today={today} />

      {data.shiftTypes.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="This site has no shifts yet"
          description="Define the shift windows on the site before rostering guards into them."
        />
      ) : (
        <RosterBoard
          siteId={siteId}
          siteName={data.site.name}
          days={days}
          today={today}
          shiftTypes={data.shiftTypes}
          shifts={data.shifts}
          guards={data.guards}
          canEdit={session.can("roster:write")}
          timezone={session.agency.timezone}
        />
      )}

      <PatternsPanel patterns={data.patterns} canEdit={session.can("roster:write")} />
    </div>
  );
}
