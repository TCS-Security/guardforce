import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadOverview } from "@/lib/data/overview";
import { PageHeader } from "@/components/gf/page-header";
import { StatTile } from "@/components/gf/stat-tile";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { AttendanceTrendChart } from "@/components/charts/attendance-trend-chart";
import { LiveAlerts, type AlertRow } from "./live-alerts";
import { ButtonLink } from "@/components/gf/button-link";
import { fmtDate } from "@/lib/domain/format";
import { kycGaps } from "@/lib/domain/kyc";
import { presenceState } from "@/lib/domain/status";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireSession();
  const data = await loadOverview(session);
  const { totals, sites } = data;

  const live = data.presence.filter((p) => p.shift_id);
  const stale = live.filter((p) => presenceState(p, session.agency.staleness_min) === "stale").length;
  const locOff = live.filter((p) => !p.location_enabled).length;
  const outside = live.filter((p) => p.in_fence === false).length;
  const kycIncomplete = data.guards.filter((g) => kycGaps(g, g.guard_documents).length > 0).length;
  const patrolsDone = (data.patrolCounts.completed ?? 0) + (data.patrolCounts.late ?? 0);
  const patrolsDue = patrolsDone + (data.patrolCounts.missed ?? 0);
  const compliance = patrolsDue > 0 ? Math.round((100 * (data.patrolCounts.completed ?? 0)) / patrolsDue) : null;
  const openAlerts = data.alerts.filter((a) => !a.acknowledged_at).length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Today · {fmtDate(new Date(), session.agency.timezone, "EEEE d MMMM")}</>}
        title={<>Good {greeting()}, {session.profile.full_name.split(" ")[0]}.</>}
        description={
          totals.on_duty === 0
            ? "No guards are on duty right now."
            : <>{totals.on_duty} guard{totals.on_duty === 1 ? "" : "s"} on duty across {sites.filter((s) => s.on_duty_now > 0).length} site{sites.filter((s) => s.on_duty_now > 0).length === 1 ? "" : "s"}. {openAlerts > 0 ? `${openAlerts} alert${openAlerts === 1 ? "" : "s"} need attention.` : "No open alerts."}</>
        }
        actions={
          <ButtonLink variant="outline" href="/live">
            <MapPinned data-icon="inline-start" /> Live map
          </ButtonLink>
        }
      />

      {/* Numbers row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="On duty now" value={totals.on_duty} tone="present" hint={`${totals.required} posts required`} style={{ ["--i" as string]: 1 }}>
          <StaffingRing filled={totals.on_duty} total={Math.max(totals.required, totals.on_duty, 1)} />
        </StatTile>
        <StatTile label="Present today" value={totals.present + totals.half_day} hint={`${totals.half_day} half day · ${totals.pending} pending`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Absent" value={totals.absent} tone={totals.absent > 0 ? "absent" : "neutral"} hint={`${totals.on_leave} on approved leave`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Flagged check-ins" value={totals.flagged} tone={totals.flagged > 0 ? "half-day" : "neutral"} hint={`${outside} outside fence · ${locOff} location off`} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Patrol compliance" value={compliance == null ? "—" : `${compliance}%`} tone={compliance != null && compliance < 85 ? "half-day" : "neutral"} hint={`${data.patrolCounts.missed ?? 0} missed · ${data.patrolCounts.late ?? 0} late today`} style={{ ["--i" as string]: 5 }} />
        <StatTile label="Needs action" value={data.pendingLeave + kycIncomplete} tone={data.pendingLeave + kycIncomplete > 0 ? "signal" : "neutral"} hint={`${data.pendingLeave} leave · ${kycIncomplete} KYC incomplete`} style={{ ["--i" as string]: 6 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Site staffing board */}
          <Section
            title="Site staffing right now"
            description="Required posts vs guards on duty inside the fence"
            actions={<ButtonLink variant="ghost" size="sm" href="/sites">All sites <ArrowRight data-icon="inline-end" /></ButtonLink>}
            bodyClassName="p-0"
            style={{ ["--i" as string]: 7 }}
          >
            <table className="w-full text-sm" aria-label="Site staffing">
              <thead>
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th className="min-w-[220px]">Site</th>
                  <th className="w-[38%]">Coverage</th>
                  <th className="text-right">Today</th>
                  <th className="text-right">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sites.map((s) => {
                  const gap = Math.max(0, s.guards_required - s.on_duty_now);
                  return (
                    <tr key={s.site_id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/sites/${s.site_id}`} className="font-medium hover:underline">{s.site_name}</Link>
                        <div className="text-xs text-muted-foreground">{s.scheduled} scheduled · {s.pending} not yet started</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <CoverageBar filled={s.on_duty_now} required={s.guards_required} />
                          <span className="font-mono tabular text-xs text-muted-foreground">
                            {s.on_duty_now}/{s.guards_required}
                          </span>
                          {gap > 0 ? (
                            <StatusPill tone="signal" size="xs">{gap} short</StatusPill>
                          ) : (
                            <StatusPill tone="present" size="xs" dot={false}>Covered</StatusPill>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular text-xs whitespace-nowrap">
                        <span className="text-present">{s.present}P</span>{" "}
                        <span className="text-half-day-foreground dark:text-half-day">{s.half_day}H</span>{" "}
                        <span className="text-absent">{s.absent}A</span>{" "}
                        <span className="text-on-leave">{s.on_leave}L</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular text-xs">
                        {s.flagged > 0 ? <span className="text-half-day-foreground dark:text-half-day">{s.flagged}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <Section title="Attendance, last 14 days" description="Per shift, all sites in your scope" style={{ ["--i" as string]: 8 }}>
            <AttendanceTrendChart data={data.trend} />
          </Section>
        </div>

        <Section
          title="Live alerts"
          description={openAlerts > 0 ? `${openAlerts} unacknowledged` : "Nothing unacknowledged"}
          actions={<ButtonLink variant="ghost" size="sm" href="/events">Feed <ArrowRight data-icon="inline-end" /></ButtonLink>}
          bodyClassName="p-0"
          className="xl:sticky xl:top-20 xl:self-start"
          style={{ ["--i" as string]: 7 }}
        >
          <LiveAlerts initial={data.alerts as unknown as AlertRow[]} />
          {stale > 0 && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              {stale} guard{stale === 1 ? "" : "s"} not seen for {session.agency.staleness_min}+ min — check the <Link href="/live" className="font-medium text-foreground underline-offset-2 hover:underline">live map</Link>.
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/** Required posts as slots; filled slots are olive, open ones are hollow. */
function CoverageBar({ filled, required }: { filled: number; required: number }) {
  const slots = Math.max(required, filled, 1);
  return (
    <div className="flex h-2.5 flex-1 gap-[3px]" aria-label={`${filled} of ${required} posts covered`}>
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-[2px]",
            i < filled ? "bg-present" : i < required ? "border border-dashed border-signal/60 bg-signal/10" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function StaffingRing({ filled, total }: { filled: number; total: number }) {
  const pct = Math.min(1, filled / total);
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-mb-1 shrink-0" aria-hidden>
      <circle cx="22" cy="22" r={r} stroke="var(--border)" strokeWidth="4" fill="none" />
      <circle cx="22" cy="22" r={r} stroke="var(--present)" strokeWidth="4" fill="none" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 22 22)" />
    </svg>
  );
}
