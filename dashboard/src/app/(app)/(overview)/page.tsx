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
import type { PermissionKey } from "@/lib/auth/permissions";
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
  const staffedSites = sites.filter((s) => s.on_duty_now > 0).length;
  const openPosts = Math.max(0, totals.required - totals.on_duty);
  const needsAction = data.pendingLeave + kycIncomplete;
  // Only link a tile at somewhere this person is allowed to go.
  const to = (key: PermissionKey, href: string) => (session.can(key) ? href : undefined);
  const day = `date=${data.today}`;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Today · {fmtDate(new Date(), session.agency.timezone, "EEEE d MMMM")}</>}
        title={<>Good {greeting()}, {session.profile.full_name.split(" ")[0]}.</>}
        description={
          totals.on_duty === 0
            ? "No guards are on duty right now."
            : <>{totals.on_duty} guard{totals.on_duty === 1 ? "" : "s"} on duty across {staffedSites} site{staffedSites === 1 ? "" : "s"}.</>
        }
        actions={
          session.can("live:read") && (
            <ButtonLink href="/live" size="lg" className="h-10 gap-2 px-4 text-[15px] font-semibold [&_svg:not([class*='size-'])]:size-[18px]">
              <MapPinned data-icon="inline-start" /> Open live map
            </ButtonLink>
          )
        }
      />

      {/* Numbers row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="On duty now"
          value={totals.on_duty}
          tone="present"
          hint={openPosts > 0 ? `${openPosts} post${openPosts === 1 ? "" : "s"} still unmanned` : "Every post is covered"}
          href={to("attendance:read", `/attendance?${day}&status=on_duty`)}
          linkLabel="See the guards who are on duty now"
          style={{ ["--i" as string]: 1 }}
        >
          <StaffingRing filled={totals.on_duty} total={Math.max(totals.required, totals.on_duty, 1)} />
        </StatTile>
        <StatTile
          label="Present today"
          value={totals.present + totals.half_day}
          hint={`${totals.present} full day, ${totals.half_day} half day · ${totals.pending} not started yet`}
          href={to("attendance:read", `/attendance?${day}&status=worked`)}
          linkLabel="See the guards marked present today"
          style={{ ["--i" as string]: 2 }}
        />
        <StatTile
          label="Absent"
          value={totals.absent}
          tone={totals.absent > 0 ? "absent" : "neutral"}
          hint={`${totals.on_leave} more on approved leave`}
          href={to("attendance:read", `/attendance?${day}&status=absent`)}
          linkLabel="See the guards who did not turn up"
          style={{ ["--i" as string]: 3 }}
        />
        <StatTile
          label="Flagged check-ins"
          value={totals.flagged}
          tone={totals.flagged > 0 ? "half-day" : "neutral"}
          hint={`${outside} outside the fence · ${locOff} with location off`}
          href={to("attendance:read", `/attendance?${day}&trust=any_flag`)}
          linkLabel="See the check-ins we could not verify"
          style={{ ["--i" as string]: 4 }}
        />
        <StatTile
          label="Patrol compliance"
          value={compliance == null ? "—" : `${compliance}%`}
          tone={compliance != null && compliance < 85 ? "half-day" : "neutral"}
          hint={`${data.patrolCounts.missed ?? 0} missed · ${data.patrolCounts.late ?? 0} late today`}
          href={to("patrols:read", `/patrols?${day}`)}
          linkLabel="See today's patrol rounds"
          style={{ ["--i" as string]: 5 }}
        />
        <StatTile
          label="Needs action"
          value={needsAction}
          tone={needsAction > 0 ? "signal" : "neutral"}
          hint={`${data.pendingLeave} leave to decide · ${kycIncomplete} missing KYC papers`}
          /* Leave decisions are the time-critical half, so send the owner there while any are waiting. */
          href={data.pendingLeave > 0 ? to("leave:read", "/leave") : to("guards:read", "/guards?kyc=incomplete")}
          linkLabel={data.pendingLeave > 0 ? "Open the leave inbox" : "See the guards with incomplete KYC"}
          style={{ ["--i" as string]: 6 }}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Site staffing board */}
          <Section
            title="Site staffing right now"
            description="Required posts vs guards on duty inside the fence"
            actions={<ButtonLink variant="ghost" size="sm" href="/sites">All sites <ArrowRight data-icon="inline-end" /></ButtonLink>}
            bodyClassName="p-0"
            style={{ ["--i" as string]: 7 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Site staffing">
                <thead>
                  <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                    <th className="min-w-[140px] sm:min-w-[220px]">Site</th>
                    <th className="w-[38%]">Coverage</th>
                    <th className="hidden text-right sm:table-cell">Today</th>
                    <th className="hidden text-right sm:table-cell">Flags</th>
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
                          {/* The two number columns are hidden on phones; fold them in under the name. */}
                          <div className="mt-1 flex items-center gap-2 sm:hidden">
                            <DayTally site={s} />
                            {s.flagged > 0 && <StatusPill tone="half-day" size="xs">{s.flagged} flagged</StatusPill>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <CoverageBar filled={s.on_duty_now} required={s.guards_required} className="hidden sm:flex" />
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
                        <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                          <DayTally site={s} />
                        </td>
                        <td className="hidden px-4 py-2.5 text-right font-mono tabular text-xs sm:table-cell">
                          {s.flagged > 0 ? <span className="text-half-day-foreground dark:text-half-day">{s.flagged}</span> : <span className="text-muted-foreground">0</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TallyLegend />
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
          className="min-w-0 xl:sticky xl:top-20 xl:self-start"
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

/** The four letters of the day tally, in the order they are printed. */
const TALLY_KEYS = [
  { key: "present", letter: "P", label: "present", className: "text-present" },
  { key: "half_day", letter: "H", label: "half day", className: "text-half-day-foreground dark:text-half-day" },
  { key: "absent", letter: "A", label: "absent", className: "text-absent" },
  { key: "on_leave", letter: "L", label: "on leave", className: "text-on-leave" },
] as const;

type SiteTally = { present: number; half_day: number; absent: number; on_leave: number };

/** Today's P/H/A/L split for one site, in tabular mono. Every number says what it is on hover. */
function DayTally({ site }: { site: SiteTally }) {
  return (
    <span className="font-mono tabular text-xs whitespace-nowrap">
      {TALLY_KEYS.map(({ key, letter, label, className }, i) => (
        <span key={key}>
          {i > 0 ? " " : ""}
          <span className={className} title={`${site[key]} ${label}`} aria-label={`${site[key]} ${label}`}>
            {site[key]}{letter}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Hairline key for the P/H/A/L tally — the letters mean nothing without it. */
function TallyLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
      <span className="eyebrow">Today reads</span>
      {TALLY_KEYS.map(({ key, letter, label, className }) => (
        <span key={key} className="whitespace-nowrap">
          <span className={cn("font-mono", className)}>{letter}</span> = {label}
        </span>
      ))}
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
function CoverageBar({ filled, required, className }: { filled: number; required: number; className?: string }) {
  const slots = Math.max(required, filled, 1);
  return (
    <div className={cn("flex h-2.5 flex-1 gap-[3px]", className)} aria-label={`${filled} of ${required} posts covered`}>
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
