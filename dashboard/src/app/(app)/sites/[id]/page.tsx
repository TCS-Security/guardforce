import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Footprints, MapPinned, Pencil, Power } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadSite, shiftTypeUsage } from "@/lib/data/sites";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { StatTile } from "@/components/gf/stat-tile";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { AttendanceBadge, ShiftStatusBadge, TrustBadge } from "@/components/gf/attendance-badge";
import { Button } from "@/components/ui/button";
import { SiteMap } from "@/components/sites/site-map";
import { ShiftTypesPanel } from "@/components/sites/shift-types";
import { SupervisorsPanel } from "@/components/sites/supervisors-panel";
import { SiteForm } from "../site-form";
import { setSiteActive } from "../actions";
import { fenceLabel, shiftWindowLabel, tallyFlags } from "@/lib/domain/sites";
import { FLAG_LABELS, presenceState } from "@/lib/domain/status";
import { fmtAgo, fmtTime, fmtSeconds } from "@/lib/domain/format";
import type { FenceSite } from "@/lib/domain/geo";
import { cn } from "cn";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "shifts", label: "Shifts" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
] as const;

export async function generateMetadata({ params }: PageProps<"/sites/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const data = await loadSite(session, id);
  return { title: data?.site.name ?? "Site" };
}

export default async function SitePage({ params, searchParams }: PageProps<"/sites/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" ? sp.tab : "overview") as (typeof TABS)[number]["key"];

  const data = await loadSite(session, id);
  if (!data) notFound();
  const { site, shiftTypes, shifts, presence, supervisors, allSupervisors, routes, guards } = data;

  const onDuty = shifts.filter((s) => s.status === "in_progress");
  const gap = Math.max(0, site.guards_required - onDuty.length);
  const flags = tallyFlags(shifts, FLAG_LABELS);
  const usage = Object.fromEntries(await shiftTypeUsage(id));
  const fenceSite: FenceSite = {
    lat: site.lat,
    lng: site.lng,
    fence_type: site.fence_type as "radius" | "polygon",
    radius_m: site.radius_m,
    polygon: site.polygon,
    leeway_m: site.leeway_m,
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <Link href="/sites" className="hover:text-foreground">Sites</Link> · {site.client_name ?? "No client"}
          </>
        }
        title={site.name}
        description={[site.address, site.city].filter(Boolean).join(", ") || undefined}
        actions={
          <div className="flex items-center gap-2">
            {!site.is_active && <StatusPill tone="neutral" dot={false}>Inactive</StatusPill>}
            <ButtonLink href={`/live?site=${site.id}`} variant="outline" size="sm">
              <MapPinned data-icon="inline-start" /> Live
            </ButtonLink>
            {session.can("sites:write") && tab !== "settings" && (
              <ButtonLink href={`/sites/${site.id}?tab=settings`} variant="outline" size="sm">
                <Pencil data-icon="inline-start" /> Edit
              </ButtonLink>
            )}
          </div>
        }
      />

      <nav className="reveal -mb-2 flex gap-1 border-b" aria-label="Site sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/sites/${site.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="On duty now"
              value={`${onDuty.length}/${site.guards_required}`}
              tone={gap > 0 ? "signal" : "present"}
              hint={gap > 0 ? `${gap} post${gap === 1 ? "" : "s"} unmanned` : "Fully covered"}
              style={{ ["--i" as string]: 1 }}
            />
            <StatTile label="Guards on roll" value={guards.length} hint={`${shiftTypes.length} shift${shiftTypes.length === 1 ? "" : "s"} defined`} style={{ ["--i" as string]: 2 }} />
            <StatTile
              label="Flags today"
              value={flags.reduce((a, f) => a + f.count, 0)}
              tone={flags.length > 0 ? "half-day" : "neutral"}
              hint={flags.length > 0 ? flags.slice(0, 2).map((f) => `${f.count} ${f.label.toLowerCase()}`).join(" · ") : "Nothing flagged"}
              style={{ ["--i" as string]: 3 }}
            />
            <StatTile label="Patrol routes" value={routes.filter((r) => r.is_active).length} hint={site.patrol_photo_required ? "Photo proof required" : "Photo proof optional"} style={{ ["--i" as string]: 4 }} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Section title="Perimeter" description={fenceLabel(site)} bodyClassName="p-0" style={{ ["--i" as string]: 5 }}>
              <SiteMap
                site={fenceSite}
                markers={presence.map((p) => ({
                  guard_id: p.guard_id,
                  name: (p.guards as unknown as { full_name: string } | null)?.full_name ?? "Guard",
                  lat: p.lat,
                  lng: p.lng,
                  in_fence: p.in_fence,
                  last_seen_at: p.last_seen_at,
                  location_enabled: p.location_enabled,
                  shift_id: p.shift_id,
                  battery_pct: p.battery_pct,
                }))}
                stalenessMin={session.agency.staleness_min}
                className="h-[340px] w-full overflow-hidden rounded-b-lg"
              />
            </Section>

            <Section title="Today" description="Every shift scheduled at this site today" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
              {shifts.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing rostered today. <Link href="/roster" className="font-medium text-foreground underline-offset-2 hover:underline">Open the roster</Link>.
                </div>
              ) : (
                <ul className="divide-y">
                  {shifts.map((s) => {
                    const guard = s.guards as unknown as { id: string; full_name: string; employee_code: string | null } | null;
                    const shiftType = shiftTypes.find((t) => t.id === s.shift_type_id);
                    const pres = presence.find((p) => p.guard_id === s.guard_id);
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                        <GuardAvatar name={guard?.full_name ?? "Guard"} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/attendance/${s.id}`} className="truncate text-sm font-medium hover:underline">
                            {guard?.full_name ?? "Guard"}
                          </Link>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {shiftType ? `${shiftType.name} ${shiftWindowLabel(shiftType)}` : "Ad hoc"}
                            {s.started_at ? ` · in ${fmtTime(s.started_at, session.agency.timezone)}` : ""}
                            {s.away_seconds > 0 ? ` · away ${fmtSeconds(s.away_seconds)}` : ""}
                            {pres?.last_seen_at && s.status === "in_progress" ? ` · seen ${fmtAgo(pres.last_seen_at)}` : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {pres && s.status === "in_progress" && presenceState(pres, session.agency.staleness_min) === "stale" && (
                            <StatusPill tone="neutral" size="xs">stale</StatusPill>
                          )}
                          <TrustBadge trust={s.trust} size="xs" />
                          {s.status === "in_progress" ? <ShiftStatusBadge status={s.status} size="xs" /> : <AttendanceBadge status={s.attendance} size="xs" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          </div>

          <Section
            title="Patrol routes"
            description="Rounds expected at this site"
            actions={<ButtonLink href="/patrols/routes" variant="ghost" size="sm">Manage <ArrowUpRight data-icon="inline-end" /></ButtonLink>}
            bodyClassName="p-0"
            style={{ ["--i" as string]: 7 }}
          >
            {routes.length === 0 ? (
              <EmptyState
                icon={<Footprints />}
                title="No patrol routes"
                description="Define the rounds a guard must walk here, and how often."
                action={<ButtonLink href="/patrols/routes" size="sm" variant="outline">Add a route</ButtonLink>}
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {routes.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.name}</div>
                      {r.description && <div className="truncate text-xs text-muted-foreground">{r.description}</div>}
                    </div>
                    <Mono className="text-muted-foreground">every {r.frequency_min} min · {r.min_photos} photo{r.min_photos === 1 ? "" : "s"}</Mono>
                    {!r.is_active && <StatusPill tone="neutral" size="xs" dot={false}>paused</StatusPill>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {tab === "shifts" && (
        <Section title="Shift types" description="The windows guards are rostered into. Overnight shifts end the next morning." style={{ ["--i" as string]: 1 }}>
          <ShiftTypesPanel siteId={site.id} shiftTypes={shiftTypes} usage={usage} canEdit={session.can("sites:write")} />
        </Section>
      )}

      {tab === "team" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Supervisors" description="Scoped access — they see only their sites" style={{ ["--i" as string]: 1 }}>
            <SupervisorsPanel siteId={site.id} assigned={supervisors} candidates={allSupervisors} canEdit={session.can("team:manage")} />
          </Section>
          <Section title={`Guards on roll (${guards.length})`} bodyClassName="p-0" style={{ ["--i" as string]: 2 }}>
            {guards.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No guards posted here yet.</div>
            ) : (
              <ul className="divide-y">
                {guards.map((g) => (
                  <li key={g.id} className="flex items-center gap-2.5 px-4 py-2">
                    <GuardAvatar name={g.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/guards/${g.id}`} className="truncate text-sm font-medium hover:underline">{g.full_name}</Link>
                      <div className="font-mono text-[11px] text-muted-foreground">{g.employee_code} · {g.designation ?? "No post set"}</div>
                    </div>
                    {g.status === "invited" && <StatusPill tone="half-day" size="xs" dot={false}>invited</StatusPill>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === "settings" && (
        <div className="flex max-w-4xl flex-col gap-4">
          <SiteForm
            site={site}
            defaults={{ lat: site.lat, lng: site.lng, radius_m: site.radius_m, leeway_m: site.leeway_m }}
            submitLabel="Save changes"
          />
          {session.can("sites:write") && (
            <Section title="Danger zone" style={{ ["--i" as string]: 4 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-sm text-muted-foreground">
                  {site.is_active
                    ? "Deactivating hides this site from rosters and the live map. History and reports are kept."
                    : "This site is inactive. Reactivate it to roster guards here again."}
                </p>
                <form action={setSiteActive}>
                  <input type="hidden" name="id" value={site.id} />
                  <input type="hidden" name="active" value={site.is_active ? "false" : "true"} />
                  <Button type="submit" variant={site.is_active ? "destructive" : "outline"} size="sm">
                    <Power data-icon="inline-start" /> {site.is_active ? "Deactivate site" : "Reactivate site"}
                  </Button>
                </form>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
