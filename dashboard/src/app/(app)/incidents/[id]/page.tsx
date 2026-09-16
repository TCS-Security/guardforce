import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinOff, Users } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadIncident, loadIncidentPositions, type IncidentPosition } from "@/lib/data/incidents";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { KvList } from "@/components/gf/kv";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { IncidentSeverityBadge, IncidentStatusBadge, IncidentTypeBadge, PositionStateBadge } from "@/components/incidents/badges";
import { IncidentMap, IncidentMapLegend } from "@/components/incidents/incident-map";
import { IncidentLifecycle } from "@/components/incidents/incident-lifecycle";
import { INCIDENT_SEVERITY, INCIDENT_TYPE, fmtGap, positionState, plottable } from "@/lib/domain/incidents";
import { fmtDate, fmtDateTime, fmtDistance, fmtTime } from "@/lib/domain/format";
import type { FenceSite } from "@/lib/domain/geo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/incidents/[id]">): Promise<Metadata> {
  const session = await requireSession();
  if (!session.can("incidents:read")) return { title: "Incidents" };
  const { id } = await params;
  const incident = await loadIncident(session, id);
  return { title: incident ? `${incident.title} · Incident` : "Incident" };
}

export default async function IncidentPage({ params }: PageProps<"/incidents/[id]">) {
  const session = await requireSession();
  requirePermission(session, "incidents:read");
  const { id } = await params;
  const incident = await loadIncident(session, id);
  if (!incident || !incident.sites) notFound();

  const positions = await loadIncidentPositions(session, id);
  const tz = session.agency.timezone;
  const site = incident.sites;
  const fenceSite: FenceSite & { name: string } = {
    name: site.name,
    lat: site.lat,
    lng: site.lng,
    fence_type: site.fence_type,
    radius_m: site.radius_m,
    polygon: site.polygon,
    leeway_m: site.leeway_m,
  };

  const located = plottable(positions);
  const onSite = positions.filter((p) => p.same_site);
  const elsewhere = positions.filter((p) => !p.same_site);
  const nearest = located
    .filter((p) => p.distance_m != null)
    .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))[0];

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/incidents" className="hover:text-foreground">Incidents</Link> · {fmtDate(incident.occurred_at, tz)}
          </>
        }
        title={incident.title}
        description={
          <>
            <Link href={`/sites/${site.id}`} className="underline-offset-2 hover:underline">{site.name}</Link>
            {" · "}
            {INCIDENT_TYPE[incident.type].label}
            {" · reported by "}
            {incident.profiles?.full_name ?? incident.reported_by_guard?.full_name ?? "the guard app"}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <IncidentSeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Happened at"
          value={fmtTime(incident.occurred_at, tz)}
          hint={fmtDate(incident.occurred_at, tz)}
          style={{ ["--i" as string]: 1 }}
        />
        <StatTile
          label="On duty then"
          value={positions.length}
          hint={`${onSite.length} at this site · ${elsewhere.length} elsewhere`}
          style={{ ["--i" as string]: 2 }}
        />
        <StatTile
          label="Positions known"
          value={`${located.length}/${positions.length}`}
          tone={positions.length > 0 && located.length < positions.length ? "half-day" : "neutral"}
          hint="The rest had no trustworthy fix at that moment"
          style={{ ["--i" as string]: 3 }}
        />
        <StatTile
          label="Nearest guard"
          value={nearest ? fmtDistance(nearest.distance_m) : "—"}
          tone={nearest ? "neutral" : "half-day"}
          hint={nearest ? nearest.guard_name : "Nobody could be placed"}
          style={{ ["--i" as string]: 4 }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Section
          title="Where everyone was"
          description={
            incident.lat == null
              ? "No exact spot was recorded, so the incident is pinned to the site."
              : "The incident is pinned where it was reported."
          }
          bodyClassName="p-0"
          style={{ ["--i" as string]: 5 }}
        >
          <IncidentMap
            site={fenceSite}
            incident={{ lat: incident.lat, lng: incident.lng, title: incident.title, occurred_at: incident.occurred_at }}
            positions={positions}
            className="h-[380px] w-full overflow-hidden"
          />
          <IncidentMapLegend unknown={positions.length - located.length} />
        </Section>

        <div className="flex flex-col gap-4">
          <Section title="What happened" style={{ ["--i" as string]: 6 }}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{incident.description}</p>
          </Section>

          <Section title="Record" style={{ ["--i" as string]: 7 }}>
            <KvList
              items={[
                { k: "Type", v: <IncidentTypeBadge type={incident.type} size="xs" /> },
                { k: "Severity", v: `${INCIDENT_SEVERITY[incident.severity].label} — ${INCIDENT_SEVERITY[incident.severity].hint}` },
                { k: "Occurred", v: <Mono>{fmtDateTime(incident.occurred_at, tz)}</Mono> },
                { k: "Logged", v: <Mono>{fmtDateTime(incident.created_at, tz)}</Mono> },
                { k: "Reported by", v: incident.profiles?.full_name ?? incident.reported_by_guard?.full_name ?? "—" },
                {
                  k: "Guard involved",
                  v: incident.guards ? (
                    <Link href={`/guards/${incident.guards.id}`} className="text-primary hover:underline">{incident.guards.full_name}</Link>
                  ) : (
                    "—"
                  ),
                },
                {
                  k: "Place",
                  v:
                    incident.lat != null && incident.lng != null ? (
                      <Mono>{incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}</Mono>
                    ) : (
                      <span className="text-muted-foreground">Site only</span>
                    ),
                },
                { k: "Closed", v: incident.resolved_at ? <Mono>{fmtDateTime(incident.resolved_at, tz)}</Mono> : "—" },
              ]}
            />
          </Section>

          <Section title="Life cycle" description="Open → investigating → resolved" style={{ ["--i" as string]: 8 }}>
            <IncidentLifecycle
              incidentId={incident.id}
              status={incident.status}
              resolution={incident.resolution}
              canWrite={session.can("incidents:write")}
            />
          </Section>
        </div>
      </div>

      <Section
        title={`Guards on duty at ${fmtTime(incident.occurred_at, tz)}`}
        description="Each guard's position fix closest in time to the incident, how far off that fix is, and how far away they were."
        bodyClassName="p-0"
        style={{ ["--i" as string]: 9 }}
      >
        {positions.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Nobody was on duty at that moment"
            description="No shift in your site scope was running when this incident happened, so there is no one to place on the map."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm" aria-label="Guard positions">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Guard</th>
                <th>Site</th>
                <th>Position from</th>
                <th>Time gap</th>
                <th className="text-right">Distance</th>
                <th className="text-right">Fence</th>
                <th className="text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...onSite, ...elsewhere].map((p) => (
                <PositionRow key={p.shift_id} p={p} occurredAt={incident.occurred_at} tz={tz} />
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  ping: "Breadcrumb trail",
  presence: "Live presence",
  check_in: "Check-in point",
  none: "Nothing reported",
};

function PositionRow({ p, occurredAt, tz }: { p: IncidentPosition; occurredAt: string; tz: string }) {
  const state = positionState(p);
  const unknown = state !== "located";
  return (
    <tr className="hover:bg-muted/40" data-testid="position-row" data-state={state}>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-2">
          <GuardAvatar name={p.guard_name} size="xs" />
          <span className="min-w-0">
            <Link href={`/guards/${p.guard_id}`} className="font-medium hover:underline">{p.guard_name}</Link>
            <Mono className="block text-[11px] text-muted-foreground">{p.employee_code ?? "—"}</Mono>
          </span>
        </span>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {p.site_name}
        {!p.same_site && <span className="ml-1.5 text-xs">(another site)</span>}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {SOURCE_LABEL[p.source] ?? p.source}
        {p.recorded_at && <Mono className="block text-[11px]">{fmtTime(p.recorded_at, tz)}</Mono>}
      </td>
      <td className="px-4 py-2.5">
        <Mono className={unknown ? "text-muted-foreground" : ""}>{fmtGap(p.gap_seconds, p.recorded_at, occurredAt)}</Mono>
      </td>
      <td className="px-4 py-2.5 text-right">
        {unknown ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPinOff className="size-3.5" /> unknown
          </span>
        ) : (
          <Mono>{fmtDistance(p.distance_m)}</Mono>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-muted-foreground">
        {unknown || p.in_fence == null ? "—" : p.in_fence ? "Inside" : "Outside"}
      </td>
      <td className="px-4 py-2.5 text-right"><PositionStateBadge state={state} /></td>
    </tr>
  );
}
