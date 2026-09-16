import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadRosterMonth, loadRosterSites, loadRosterWeek } from "@/lib/data/roster";
import { PageHeader } from "@/components/gf/page-header";
import { EmptyState } from "@/components/gf/empty-state";
import { RosterBoard } from "@/components/roster/roster-board";
import { RosterMonthBoard } from "@/components/roster/roster-month-board";
import { RosterToolbar } from "@/components/roster/roster-toolbar";
import { PatternsPanel } from "@/components/roster/patterns-panel";
import { fmtDate, toLocalDate } from "@/lib/domain/format";
import { dayAnchor, monthLabel, parseRosterView } from "@/lib/domain/roster";

export const metadata: Metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  const view = parseRosterView(sp.view);
  // `week` is the anchor date for both views: the week, or the month, that contains it.
  const weekParam = typeof sp.week === "string" && ISO_DATE.test(sp.week) ? sp.week : null;
  const focusDay = typeof sp.day === "string" && ISO_DATE.test(sp.day) ? sp.day : null;
  // Default to today in the agency's timezone, not the server's: an IST evening is
  // already tomorrow in UTC, which would open the wrong week (and, on the 1st, month).
  const today = toLocalDate(new Date(), session.agency.timezone);
  const anchorDate = weekParam ?? today;
  const anchor = dayAnchor(anchorDate);

  const data = view === "month" ? await loadRosterMonth(session, siteId, anchor) : await loadRosterWeek(session, siteId, anchor);
  if (!data.site) notFound();
  const days = data.days;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <PageHeader
        eyebrow={`${data.site.name} · ${view === "month" ? monthLabel(anchor) : `week of ${fmtDate(`${days[0]}T00:00:00Z`, "UTC", "d MMM yyyy")}`}`}
        title="Roster"
        description="Assign guards to shifts across the week."
      />

      <RosterToolbar
        sites={sites}
        siteId={siteId}
        anchor={anchorDate}
        days={days}
        today={today}
        view={view}
        canEdit={session.can("roster:write")}
      />

      {data.shiftTypes.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="This site has no shifts yet"
          description="Define the shift windows on the site before rostering guards into them."
        />
      ) : view === "month" ? (
        <RosterMonthBoard
          siteId={siteId}
          siteName={data.site.name}
          anchor={anchor}
          days={days}
          today={today}
          shiftTypes={data.shiftTypes}
          shifts={data.shifts}
        />
      ) : (
        <RosterBoard
          siteId={siteId}
          siteName={data.site.name}
          days={days}
          today={today}
          focusDay={focusDay}
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
