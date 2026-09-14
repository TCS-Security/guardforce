import type { Metadata } from "next";
import Link from "next/link";
import { Footprints, Settings2 } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPatrolBoard } from "@/lib/data/patrols";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { Mono } from "@/components/gf/mono";
import { PatrolStatusBadge } from "@/components/gf/attendance-badge";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { DayFilter } from "@/components/patrols/day-filter";
import { ComplianceBar } from "@/components/patrols/compliance-bar";
import { complianceTone, dueCount, latenessMin } from "@/lib/domain/patrols";
import { fmtDistance, fmtMinutes, fmtTime, toLocalDate } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Patrols" };
export const dynamic = "force-dynamic";

export default async function PatrolsPage({ searchParams }: PageProps<"/patrols">) {
  const session = await requireSession();
  requirePermission(session, "patrols:read");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toLocalDate(new Date(), session.agency.timezone);
  const siteId = typeof sp.site === "string" ? sp.site : null;

  const { perSite, sites, overall, compliance } = await loadPatrolBoard(session, date, siteId);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <PageHeader
        eyebrow="Did patrolling happen?"
        title="Patrols"
        description="Every round that was due, whether it was walked, and the proof that came back."
        actions={
          <ButtonLink href="/patrols/routes" variant="outline">
            <Settings2 data-icon="inline-start" /> Routes
          </ButtonLink>
        }
      />

      <DayFilter date={date} siteId={siteId} sites={sites} basePath="/patrols" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Compliance"
          value={compliance == null ? "—" : `${compliance}%`}
          tone={complianceTone(compliance)}
          hint={`${dueCount(overall)} round${dueCount(overall) === 1 ? "" : "s"} due so far`}
          style={{ ["--i" as string]: 1 }}
        />
        <StatTile label="On time" value={overall.completed} tone="present" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Late" value={overall.late} tone={overall.late ? "half-day" : "neutral"} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Missed" value={overall.missed} tone={overall.missed ? "absent" : "neutral"} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Still due" value={overall.scheduled + overall.in_progress} hint={`${overall.in_progress} walking now`} style={{ ["--i" as string]: 5 }} />
      </div>

      {perSite.every((s) => s.patrols.length === 0) ? (
        <EmptyState
          icon={<Footprints />}
          title="No rounds scheduled for this day"
          description="Rounds appear once a guard starts a shift at a site with an active patrol route."
          action={<ButtonLink href="/patrols/routes" variant="outline" size="sm">Set up a route</ButtonLink>}
        />
      ) : (
        perSite
          .filter((s) => s.patrols.length > 0)
          .map((entry, i) => (
            <Section
              key={entry.site.id}
              title={entry.site.name}
              description={
                entry.site.patrol_photo_required ? "Photo proof required to close a round" : "Photo proof optional at this site"
              }
              actions={
                <div className="flex items-center gap-3">
                  <ComplianceBar tally={entry.tally} />
                  <span className={`font-display tabular text-lg font-semibold ${
                    complianceTone(entry.compliance) === "present" ? "text-present"
                      : complianceTone(entry.compliance) === "half-day" ? "text-half-day-foreground dark:text-half-day"
                      : complianceTone(entry.compliance) === "absent" ? "text-absent" : ""
                  }`}>
                    {entry.compliance == null ? "—" : `${entry.compliance}%`}
                  </span>
                </div>
              }
              bodyClassName="p-0"
              style={{ ["--i" as string]: 6 + i }}
            >
              <table className="w-full text-sm" aria-label={`Patrols at ${entry.site.name}`}>
                <thead>
                  <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                    <th>Expected</th>
                    <th>Round</th>
                    <th>Guard</th>
                    <th>Walked</th>
                    <th className="text-right">Duration</th>
                    <th className="text-right">Distance</th>
                    <th className="text-right">Photos</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entry.patrols.map((p) => {
                    const late = latenessMin(p.expected_at, p.started_at);
                    return (
                      <tr key={p.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2"><Mono>{fmtTime(p.expected_at, session.agency.timezone)}</Mono></td>
                        <td className="px-4 py-2">
                          <Link href={`/patrols/${p.id}`} className="font-medium hover:underline">{p.patrol_routes?.name ?? "Round"}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            <GuardAvatar name={p.guards?.full_name ?? "Guard"} size="xs" />
                            <span className="truncate">{p.guards?.full_name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <Mono>{fmtTime(p.started_at, session.agency.timezone)}</Mono>
                          {late > 0 && <span className="ml-1 font-mono text-[10px] text-muted-foreground">+{late}m</span>}
                        </td>
                        <td className="px-4 py-2 text-right"><Mono>{p.duration_s ? fmtMinutes(p.duration_s / 60) : "—"}</Mono></td>
                        <td className="px-4 py-2 text-right"><Mono>{p.distance_m ? fmtDistance(p.distance_m) : "—"}</Mono></td>
                        <td className="px-4 py-2 text-right">
                          <Mono className={p.patrol_photos.length < (p.patrol_routes?.min_photos ?? 0) && p.status !== "scheduled" ? "text-half-day-foreground dark:text-half-day" : ""}>
                            {p.patrol_photos.length}/{p.patrol_routes?.min_photos ?? 0}
                          </Mono>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {p.status === "scheduled" ? <StatusPill tone="neutral" size="xs">due</StatusPill> : <PatrolStatusBadge status={p.status} size="xs" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          ))
      )}
    </div>
  );
}
