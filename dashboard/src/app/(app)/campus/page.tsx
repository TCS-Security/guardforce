import Link from "next/link";
import { ArrowRight, DoorOpen, Landmark } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { visitorStats, watchlist, VISITOR_STATUS } from "@/lib/campus/visitors";
import { floorStates, INSPECTION_STATE } from "@/lib/campus/inspections";
import { effectiveStatus } from "@/lib/campus/passes";
import { fmtDateTime, fmtMinutes, fmtTime } from "@/lib/domain/format";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { StatTile } from "@/components/gf/stat-tile";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { ButtonLink } from "@/components/gf/button-link";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { InflowChart, TenantDonut } from "@/components/campus/campus-charts";
import { CampusRadar } from "@/components/campus/campus-radar";
import { Battery, Code, PersonCell } from "@/components/campus/campus-bits";

export const dynamic = "force-dynamic";

export default async function CampusPage({ searchParams }: PageProps<"/campus">) {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const { site } = await searchParams;
  const { sites, data } = await loadCampus(session, typeof site === "string" ? site : null);

  if (!data) {
    return (
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <PageHeader eyebrow="Gate & campus" title="Campus overview" />
        <EmptyState icon={<Landmark />} title="No sites in your scope" description="Add a site first; the campus is set up on top of it." />
      </div>
    );
  }

  const now = new Date(data.now);
  const q = `?site=${data.campus.site_id}`;
  const vs = visitorStats(data.visitors, now);
  const flags = watchlist(data.visitors, now);
  const floors = floorStates(data.floors, data.inspections, data.today, now);
  const done = floors.filter((f) => f.state === "completed" || f.state === "pending_approval").length;
  const active = data.deployments.filter((d) => !d.reserve);
  const online = active.filter((d) => d.online).length;
  const lowBattery = active.filter((d) => d.battery_pct != null && d.battery_pct < 20).length;
  const passesActive = data.passes.filter((p) => effectiveStatus(p, now) === "active").length;
  const byTenant = data.tenants
    .map((t) => ({ name: t.name.replace(/ (Pvt Ltd|Services|Labs|Clinics|Co-working)$/, ""), value: data.visitors.filter((v) => v.tenant_id === t.id && v.status !== "expected").length }))
    .filter((t) => t.value > 0);
  const floorName = (id: string) => data.floors.find((f) => f.id === id)?.name ?? "—";
  const cpName = (id: string) => data.checkpoints.find((c) => c.id === id)?.location ?? "—";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.client_name ?? data.campus.name}</>}
        title="Campus overview"
        description={<>Visitors, gate passes, floor checks and guards on post at {data.campus.name}, on one page.</>}
        actions={
          <>
            <SiteSwitcher sites={sites} value={data.campus.site_id} />
            <ButtonLink href={`/visitors${q}&new=1`} size="lg" className="h-9 gap-2"><DoorOpen data-icon="inline-start" /> New gate entry</ButtonLink>
          </>
        }
      />
      <PreviewBanner />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Visitors today" value={vs.total - vs.expected} hint={`${data.visitors.filter((v) => v.pre_authorised).length} pre-authorised by hosts`} href={`/visitors${q}`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Awaiting host" value={vs.pending} tone={vs.pending ? "half-day" : "neutral"} hint={`${vs.viaWhatsapp} answered on WhatsApp today`} href={`/visitors${q}&tab=approvals`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="On premises" value={vs.onPremises} tone="present" hint={flags.filter((f) => f.reason === "overstay").length ? `${flags.filter((f) => f.reason === "overstay").length} past the 2-hour limit` : "Nobody overstaying"} href={`/visitors${q}&tab=watchlist`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Floor checks" value={`${done}/${floors.length}`} tone={floors.some((f) => f.state === "missed") ? "absent" : "neutral"} hint={`${floors.filter((f) => f.state === "pending_approval").length} awaiting your sign-off`} href={`/inspections${q}`} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Guards online" value={`${online}/${active.length}`} tone={online < active.length ? "half-day" : "present"} hint={lowBattery ? `${lowBattery} phone${lowBattery === 1 ? "" : "s"} under 20% battery` : "Every phone above 20%"} href={`/deployments${q}`} style={{ ["--i" as string]: 5 }} />
        <StatTile label="Active gate passes" value={passesActive} hint={`${data.passes.filter((p) => p.type === "work_permit" && effectiveStatus(p, now) === "active").length} contractor work permits`} href={`/gate-passes${q}`} style={{ ["--i" as string]: 6 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section title="Gate footfall by hour" description="Visitors through every gate, today against yesterday" style={{ ["--i" as string]: 7 }}>
          <InflowChart data={data.hourly} />
        </Section>
        <Section title="Visits by tenant" description="Who people came to see today" actions={<ButtonLink variant="ghost" size="sm" href={`/visitors${q}`}>Register <ArrowRight data-icon="inline-end" /></ButtonLink>} style={{ ["--i" as string]: 7 }}>
          <TenantDonut data={byTenant} />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Section title="Guards on post" description="Phone battery and signal, live from the guard app" actions={<ButtonLink variant="ghost" size="sm" href={`/deployments${q}`}>Posts <ArrowRight data-icon="inline-end" /></ButtonLink>} bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
          <table className="w-full text-sm" aria-label="Guards on post">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Guard</th><th className="hidden sm:table-cell">Post</th><th>Battery</th><th className="text-right">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {active.map((d) => (
                <tr key={d.guard.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/guards/${d.guard.id}`} className="hover:underline"><PersonCell guard name={d.guard.full_name} sub={d.guard.employee_code ?? undefined} /></Link>
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">{d.post}</td>
                  <td className="px-4 py-2.5"><Battery pct={d.battery_pct} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {d.online ? <StatusPill tone="present" size="xs" pulse>Online</StatusPill> : <StatusPill tone="neutral" size="xs">Seen {d.last_seen_at ? fmtTime(d.last_seen_at) : "—"}</StatusPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Today's floor checks" description="QR + geofence + photo + checklist, per floor" actions={<ButtonLink variant="ghost" size="sm" href={`/inspections${q}`}>Surveys <ArrowRight data-icon="inline-end" /></ButtonLink>} bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
          <ul className="divide-y">
            {floors.map(({ floor, state, latest, last }) => (
              <li key={floor.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{floor.name}</div>
                  <div className="text-xs text-muted-foreground"><Code>{floor.code}</Code> · last {last ? fmtDateTime(last.finished_at) : "never"}</div>
                </div>
                <StatusPill tone={INSPECTION_STATE[state].tone} size="xs">{INSPECTION_STATE[state].label}{latest && Object.values(latest.answers).includes(false) ? " · fault" : ""}</StatusPill>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Campus board" description="Towers, gates and who is standing where — a dashed block has nobody online" style={{ ["--i" as string]: 9 }}>
          <CampusRadar data={data} />
        </Section>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Checkpoint trail" description="The latest scans and check-ins, newest first" bodyClassName="p-0" style={{ ["--i" as string]: 9 }}>
            <ul className="max-h-[230px] divide-y overflow-auto">
              {data.breadcrumbs.slice(0, 10).map((b) => {
                const g = data.deployments.find((d) => d.guard.id === b.guard_id)?.guard;
                return (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <Mono className="w-12 shrink-0 text-xs text-muted-foreground">{fmtTime(b.at)}</Mono>
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{g?.full_name ?? "Guard"}</span> · {b.activity} · <span className="text-muted-foreground">{cpName(b.checkpoint_id)}</span></span>
                    <StatusPill tone="olive" size="xs" dot={false}>GPS ±{b.accuracy_m} m</StatusPill>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section title="Watchlist" description="Over the stay limit, or turned away by a host" actions={<ButtonLink variant="ghost" size="sm" href={`/visitors${q}&tab=watchlist`}>All <ArrowRight data-icon="inline-end" /></ButtonLink>} bodyClassName="p-0" style={{ ["--i" as string]: 10 }}>
            {flags.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nobody to watch right now.</p> : (
              <ul className="divide-y">
                {flags.map((f) => (
                  <li key={f.visitor.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.visitor.name} <span className="font-normal text-muted-foreground">· {f.visitor.company}</span></div>
                      <div className="truncate text-xs text-muted-foreground">for {data.tenants.find((t) => t.id === f.visitor.tenant_id)?.name} · {floorName(data.tenants.find((t) => t.id === f.visitor.tenant_id)?.floor_id ?? "")}</div>
                    </div>
                    {f.reason === "overstay"
                      ? <StatusPill tone="signal" size="xs">{fmtMinutes(f.minutes)} inside</StatusPill>
                      : <StatusPill tone={VISITOR_STATUS.rejected.tone} size="xs">Denied by host</StatusPill>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
