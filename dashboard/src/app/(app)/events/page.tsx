import type { Metadata } from "next";
import { Radio } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadEvents, parseEventFilters, EVENTS_PAGE_SIZE } from "@/lib/data/events";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { Button } from "@/components/ui/button";
import { EventFiltersBar } from "@/components/events/event-filters";
import { EventRow } from "@/components/events/event-row";
import { acknowledgeEvents } from "./actions";
import { fmtDate, fmtTime, toLocalDate } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const session = await requireSession();
  requirePermission(session, "events:read");
  const sp = await searchParams;
  const today = toLocalDate(new Date(), session.agency.timezone);
  const filters = parseEventFilters(sp, today);
  const { rows, total, pageCount, sites, guards } = await loadEvents(session, filters);

  const open = rows.filter((r) => !r.acknowledged_at && r.severity !== "info");
  const qs = (page: number) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])));
    q.set("page", String(page));
    return `/events?${q.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <PageHeader
        eyebrow="Monitor"
        title="Events"
        description="Everything the system saw: check-ins, fence crossings, outages, patrols, tasks and leave."
        actions={
          open.length > 0 && session.can("events:acknowledge") ? (
            <form action={acknowledgeEvents}>
              <input type="hidden" name="ids" value={open.map((e) => e.id).join(",")} />
              <Button type="submit" variant="outline">Acknowledge {open.length} shown</Button>
            </form>
          ) : null
        }
      />

      <EventFiltersBar filters={filters} sites={sites} guards={guards} />

      <Section
        title={filters.from === filters.to ? fmtDate(`${filters.from}T12:00:00`, session.agency.timezone) : `${filters.from} → ${filters.to}`}
        description={`${total} event${total === 1 ? "" : "s"}${open.length ? ` · ${open.length} unacknowledged on this page` : ""}`}
        bodyClassName="p-0"
        style={{ ["--i" as string]: 2 }}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Radio />}
            title="No events for this filter"
            description="Widen the date range or clear a filter."
            className="border-0"
          />
        ) : (
          <ul className="divide-y" data-testid="event-feed">
            {rows.map((e) => (
              <EventRow key={e.id} event={e} time={fmtTime(e.created_at, session.agency.timezone)} />
            ))}
          </ul>
        )}
      </Section>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {filters.page} of {pageCount} · {EVENTS_PAGE_SIZE} per page
          </span>
          <div className="flex gap-2">
            <ButtonLink href={qs(Math.max(1, filters.page - 1))} variant="outline" size="sm" aria-disabled={filters.page === 1}>
              Previous
            </ButtonLink>
            <ButtonLink href={qs(Math.min(pageCount, filters.page + 1))} variant="outline" size="sm" aria-disabled={filters.page === pageCount}>
              Next
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
