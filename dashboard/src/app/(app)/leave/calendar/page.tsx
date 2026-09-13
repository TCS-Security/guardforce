import { Inbox } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadCalendarMonth, loadSiteOptions, todayISO } from "@/lib/data/leave";
import { monthLabel, parseMonthParam, shiftMonth } from "@/lib/domain/leave";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { CalendarControls } from "@/components/leave/calendar-controls";
import { LeaveCalendarGrid } from "@/components/leave/leave-calendar-grid";

export const dynamic = "force-dynamic";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LeaveCalendarPage({ searchParams }: PageProps<"/leave/calendar">) {
  const session = await requireSession();
  const sp = await searchParams;
  const today = todayISO(session);
  const sites = await loadSiteOptions(session);

  const requestedSite = one(sp.site);
  const siteId = requestedSite && sites.some((s) => s.id === requestedSite) ? requestedSite : (sites[0]?.id ?? null);
  const parsed = parseMonthParam(one(sp.m));
  const year = parsed?.year ?? Number(today.slice(0, 4));
  const month = parsed?.month ?? Number(today.slice(5, 7));

  const days = siteId ? await loadCalendarMonth(session, siteId, year, month) : [];
  const siteName = sites.find((s) => s.id === siteId)?.name ?? "site";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Leave · Calendar</>}
        title="Leave calendar"
        description={<>Who is out at {siteName}, day by day — approved leave as chips, pending requests dashed. Days with 2+ guards on approved leave are marked thin cover.</>}
        actions={
          <ButtonLink variant="outline" href="/leave">
            <Inbox data-icon="inline-start" /> Inbox
          </ButtonLink>
        }
      />

      {siteId ? (
        <Section
          title={monthLabel(year, month)}
          description={`Approved + pending leave at ${siteName} — click a day for details`}
          style={{ ["--i" as string]: 1 }}
        >
          <div className="flex flex-col gap-4">
            <CalendarControls
              sites={sites}
              siteId={siteId}
              month={`${year}-${String(month).padStart(2, "0")}`}
              prevMonth={shiftMonth(year, month, -1)}
              nextMonth={shiftMonth(year, month, 1)}
              monthLabel={monthLabel(year, month)}
            />
            <LeaveCalendarGrid days={days} today={today} />
          </div>
        </Section>
      ) : (
        <EmptyState title="No active sites" description="Create a site first to see its leave calendar." />
      )}
    </div>
  );
}
