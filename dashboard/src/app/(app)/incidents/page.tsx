import type { Metadata } from "next";
import Link from "next/link";
import { Siren } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadIncidents } from "@/lib/data/incidents";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { IncidentFiltersBar } from "@/components/incidents/incident-filters";
import { LogIncidentDialog } from "@/components/incidents/log-incident-dialog";
import { IncidentSeverityBadge, IncidentStatusBadge, IncidentTypeBadge } from "@/components/incidents/badges";
import { incidentTally, parseIncidentFilters } from "@/lib/domain/incidents";
import { fmtDate, fmtDateTime, toLocalDate, toLocalInput } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Incidents" };
export const dynamic = "force-dynamic";

export default async function IncidentsPage({ searchParams }: PageProps<"/incidents">) {
  const session = await requireSession();
  requirePermission(session, "incidents:read");
  const sp = await searchParams;
  const tz = session.agency.timezone;
  const filters = parseIncidentFilters(sp, toLocalDate(new Date(), tz));
  const { rows, sites, guards } = await loadIncidents(session, filters);
  const tally = incidentTally(rows);

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <PageHeader
        eyebrow="Serious occurrences"
        title="Incidents"
        description="Fights, thefts, fires, medical emergencies — what a person reported, what was done about it, and where every guard was at the time."
        actions={
          session.can("incidents:write") ? (
            <LogIncidentDialog sites={sites} guards={guards} defaultNow={toLocalInput(new Date(), tz)} />
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="In range" value={tally.total} hint={`${fmtDate(`${filters.from}T12:00:00`, tz)} → ${fmtDate(`${filters.to}T12:00:00`, tz)}`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Open" value={tally.open} tone={tally.open > 0 ? "absent" : "neutral"} hint="Nobody has picked these up yet" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Investigating" value={tally.investigating} tone={tally.investigating > 0 ? "half-day" : "neutral"} hint="Being worked on" style={{ ["--i" as string]: 3 }} />
        <StatTile label="Critical, unclosed" value={tally.critical} tone={tally.critical > 0 ? "signal" : "neutral"} hint="Injury, police, or the contract at risk" style={{ ["--i" as string]: 4 }} />
      </div>

      <IncidentFiltersBar filters={filters} sites={sites} />

      <Section
        title={`${rows.length} incident${rows.length === 1 ? "" : "s"}`}
        description="Newest first, by when it happened — not when it was typed up."
        bodyClassName="p-0"
        style={{ ["--i" as string]: 5 }}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Siren />}
            title="No incidents match"
            description="Widen the dates or clear a filter. An empty log for a busy month is worth checking — incidents only appear when someone reports them."
            className="border-0"
          />
        ) : (
          <table className="w-full table-fixed text-sm" aria-label="Incidents">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th className="w-[38%]">Incident</th>
                <th className="w-[15%]">Site</th>
                <th className="w-[16%]">Guard</th>
                <th className="w-[12%]">When</th>
                <th className="text-right">Severity</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-muted/40">
                  <td className="max-w-0 px-4 py-2.5">
                    <Link href={`/incidents/${i.id}`} className="font-medium hover:underline">{i.title}</Link>
                    <div className="mt-1 flex items-center gap-1.5">
                      <IncidentTypeBadge type={i.type} size="xs" />
                      <span className="line-clamp-1 min-w-0 text-xs text-muted-foreground">{i.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{i.sites?.name}</td>
                  <td className="px-4 py-2.5">
                    {i.guards ? (
                      <span className="flex items-center gap-2">
                        <GuardAvatar name={i.guards.full_name} size="xs" />
                        <span className="line-clamp-1 min-w-0">{i.guards.full_name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Mono className="text-muted-foreground">{fmtDateTime(i.occurred_at, tz)}</Mono>
                  </td>
                  <td className="px-4 py-2.5 text-right"><IncidentSeverityBadge severity={i.severity} size="xs" /></td>
                  <td className="px-4 py-2.5 text-right"><IncidentStatusBadge status={i.status} size="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
