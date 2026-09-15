import type { Metadata } from "next";
import { format, startOfMonth, subDays } from "date-fns";
import { requirePermission, requireSession } from "@/lib/auth/session";
import {
  loadFilterOptions,
  loadGuardScorecards,
  loadLeaveReportRows,
  loadMusterRows,
  loadPatrolReportRows,
  loadShiftReportRows,
  loadDigest,
} from "@/lib/data/reports";
import {
  attendanceRate,
  buildDigestText,
  buildMusterMatrix,
  buildSiteRangeSummary,
  dailyAttendanceColumns,
  daysInRange,
  leaveColumns,
  monthRange,
  musterColumns,
  patrolColumns,
  punchColumns,
  summariseShiftRows,
  toPatrolExportRows,
  toPunchRows,
} from "@/lib/domain/reports";
import { PageHeader } from "@/components/gf/page-header";
import { StatTile } from "@/components/gf/stat-tile";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { DataTable } from "@/components/gf/data-table";
import { AttendanceTrendChart } from "@/components/charts/attendance-trend-chart";
import { fmtDate, fmtMinutes, fmtPct, toLocalDate } from "@/lib/domain/format";
import { createClient } from "@/lib/supabase/server";
import { ReportFilterBar } from "./filter-bar";
import { ScorecardTable } from "./scorecard-table";
import { ExportCard } from "./export-card";
import { MusterControls } from "./muster-controls";
import { DigestControls } from "./digest-controls";
import { CopyDigestButton } from "./copy-digest-button";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const session = await requireSession();
  requirePermission(session, "reports:read");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const tz = session.agency.timezone;
  const today = toLocalDate(new Date(), tz);

  const preset = str(sp.preset) ?? "7d";
  const to = str(sp.to) ?? today;
  const from = str(sp.from) ?? (preset === "30d" ? format(subDays(new Date(), 29), "yyyy-MM-dd") : preset === "month" ? format(startOfMonth(new Date()), "yyyy-MM-dd") : format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const siteId = str(sp.site) ?? null;
  const guardId = str(sp.guard) ?? null;

  const musterSite = str(sp.musterSite) ?? siteId ?? null;
  const musterMonth = str(sp.musterMonth) ?? today.slice(0, 7);
  const musterRangeBounds = monthRange(musterMonth);

  const digestDate = str(sp.digestDate) ?? today;

  const [filterOptions, shiftRows, scorecards, patrolRows, leaveRows, musterRows, digest] = await Promise.all([
    loadFilterOptions(),
    loadShiftReportRows({ from, to, siteId, guardId }),
    loadGuardScorecards({ from, to, siteId, guardId }),
    loadPatrolReportRows({ from, to, siteId }),
    loadLeaveReportRows({ from, to, siteId }),
    loadMusterRows({ from: musterRangeBounds.from, to: musterRangeBounds.to, siteId: musterSite }),
    loadDigest(session, digestDate),
  ]);

  const supabase = await createClient();
  const { data: trend } = await supabase.rpc("attendance_trend", { p_agency_id: session.agency.id, p_from: from, p_to: to, p_site_id: siteId ?? undefined });

  const totals = summariseShiftRows(shiftRows);
  const siteTable = buildSiteRangeSummary(shiftRows);
  const musterDays = daysInRange(musterRangeBounds.from, musterRangeBounds.to);
  const musterMatrix = buildMusterMatrix(musterRows, musterDays);
  const digestText = buildDigestText(digest, fmtDate(new Date(`${digest.date}T00:00:00`), tz, "EEEE d MMMM"));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Analytics & exports"
        title="Reports"
        description="Attendance analytics, guard scorecards and spreadsheet exports for any site, guard or date range."
      />

      <ReportFilterBar
        sites={filterOptions.sites}
        guards={filterOptions.guards}
        current={{ site: siteId ?? "", guard: guardId ?? "", from, to, preset }}
      />

      {/* Section 1: attendance analytics ------------------------------------------------ */}
      <Section title="Attendance analytics" description={`${fmtDate(new Date(`${from}T00:00:00`), tz)} – ${fmtDate(new Date(`${to}T00:00:00`), tz)}`} style={{ ["--i" as string]: 2 }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile label="Attendance rate" value={fmtPct(totals.attendance_rate)} hint={`${totals.present + totals.half_day} of ${totals.scheduled} shifts`} />
          <StatTile label="Punctuality" value={fmtPct(totals.punctuality_pct)} hint="On-time starts / shifts started" />
          <StatTile label="Avg away time" value={fmtMinutes(totals.avg_away_min)} hint="Per completed shift" />
          <StatTile label="Flagged" value={fmtPct(totals.flagged_pct)} tone={totals.flagged > 0 ? "half-day" : "neutral"} hint={`${totals.flagged} shifts`} />
          <StatTile label="Void shifts" value={totals.void} tone={totals.void > 0 ? "absent" : "neutral"} hint="Location off at shift end" />
        </div>

        <div className="mt-4 rounded-lg border">
          <div className="border-b px-4 py-2.5">
            <h3 className="font-display text-[15px] font-semibold tracking-tight">Daily trend</h3>
          </div>
          <div className="p-4">
            {trend && trend.length > 0 ? <AttendanceTrendChart data={trend} /> : <EmptyState title="No shifts in range" className="border-0 py-8" />}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <DataTable
            ariaLabel="Per-site attendance"
            rows={siteTable}
            rowKey={(s) => s.site_id}
            empty={<EmptyState title="No shifts in range" className="border-0 py-10" />}
            columns={[
              { key: "site", header: "Site", pin: true, width: 240, className: "font-medium", cell: (s) => s.site_name },
              { key: "scheduled", header: "Scheduled", align: "right", className: "font-mono tabular", cell: (s) => s.scheduled },
              { key: "present", header: "Present", align: "right", className: "font-mono tabular text-present", cell: (s) => s.present },
              { key: "half", header: "Half day", align: "right", className: "font-mono tabular text-half-day-foreground dark:text-half-day", cell: (s) => s.half_day },
              { key: "absent", header: "Absent", align: "right", className: "font-mono tabular text-absent", cell: (s) => s.absent },
              { key: "leave", header: "On leave", align: "right", className: "font-mono tabular text-on-leave", cell: (s) => s.on_leave },
              { key: "flagged", header: "Flagged", align: "right", className: "font-mono tabular", cell: (s) => s.flagged },
            ]}
          />
        </div>
      </Section>

      {/* Section 2: guard scorecards ------------------------------------------------------ */}
      <Section title="Guard scorecards" description="Punctuality, attendance mix and patrol misses for the filtered range" bodyClassName="p-0" style={{ ["--i" as string]: 3 }}>
        <ScorecardTable rows={scorecards} />
      </Section>

      {/* Section 3: reports & CSV exports --------------------------------------------------- */}
      <div className="reveal flex flex-col gap-4" style={{ ["--i" as string]: 4 }}>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Reports & spreadsheet exports</h2>
          <p className="text-sm text-muted-foreground">
            Every report downloads as CSV (opens in Excel and Google Sheets) or as a real Excel workbook with typed dates, a frozen header and the
            identity columns pinned. Scroll a preview sideways — the first columns stay put.
          </p>
        </div>

        <ExportCard
          title="Daily attendance"
          description="One row per shift: in/out times, late minutes, hours worked, attendance and flags."
          href={`/reports/export/daily-attendance?${qs({ site: siteId, guard: guardId, from, to })}`}
          rows={shiftRows}
          columns={dailyAttendanceColumns(tz)}
          emptyLabel="No shifts in the selected range."
        />

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-[15px] font-semibold tracking-tight">Muster roll</h3>
              <p className="text-xs text-muted-foreground">One row per guard, one column per day of the month — P / H / A / L / – codes.</p>
            </div>
            <MusterControls sites={filterOptions.sites} site={musterSite ?? ""} month={musterMonth} />
          </div>
          <ExportCard
            href={`/reports/export/muster-roll?${qs({ site: musterSite, month: musterMonth })}`}
            rows={musterMatrix}
            columns={musterColumns(musterDays)}
            emptyLabel="No shifts in this month."
          />
        </div>

        <ExportCard
          title="Punch in / out"
          description="Every check-in and check-out with the time, a Google Maps link to where it happened, the in-fence flag and the device."
          href={`/reports/export/punch?${qs({ site: siteId, guard: guardId, from, to })}`}
          rows={toPunchRows(shiftRows)}
          columns={punchColumns(tz)}
          emptyLabel="No punches in the selected range."
        />

        <ExportCard
          title="Patrol compliance"
          description="Expected/started/ended/status/photos/distance per patrol, plus a per-route compliance summary."
          href={`/reports/export/patrol-compliance?${qs({ site: siteId, from, to })}`}
          rows={toPatrolExportRows(patrolRows)}
          columns={patrolColumns(tz)}
          emptyLabel="No patrols in the selected range."
        />

        <ExportCard
          title="Leave register"
          description="Every leave request in range with type, dates, status and who decided it."
          href={`/reports/export/leave-register?${qs({ site: siteId, from, to })}`}
          rows={leaveRows}
          columns={leaveColumns(tz)}
          emptyLabel="No leave requests in the selected range."
        />
      </div>

      {/* Section 4: daily digest preview --------------------------------------------------- */}
      <Section
        title="Daily digest preview"
        description="The 9 AM owner digest — delivery via WhatsApp/email is wired up later; copy the text for now."
        actions={<DigestControls date={digestDate} />}
        style={{ ["--i" as string]: 5 }}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="eyebrow">{session.agency.name} — attendance digest</div>
            <div className="mt-0.5 font-display text-lg font-semibold">{fmtDate(new Date(`${digest.date}T00:00:00`), tz, "EEEE d MMMM yyyy")}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {digest.sites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sites.</p>
              ) : (
                digest.sites.map((s) => (
                  <div key={s.site_name} className="rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="font-medium">{s.site_name}</div>
                    <div className="mt-0.5 font-mono text-xs tabular text-muted-foreground">
                      <span className="text-present">{s.present}P</span> · <span className="text-half-day-foreground dark:text-half-day">{s.half_day}H</span> · <span className="text-absent">{s.absent}A</span> · <span className="text-on-leave">{s.on_leave}L</span>
                      {s.pending > 0 && <> · {s.pending} not started</>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 border-t pt-3 text-sm">
              Overall: <span className="font-mono tabular font-semibold">{digest.totals.present + digest.totals.half_day}/{Math.max(0, digest.totals.scheduled - digest.totals.on_leave)}</span> on duty
              {attendanceRate(digest.totals) != null && <> ({fmtPct(attendanceRate(digest.totals))})</>}
            </div>
            {digest.anomalies.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No anomalies for this day.</p>
            ) : (
              <div className="mt-3 border-t pt-3">
                <div className="eyebrow text-signal">Needs attention</div>
                <ul className="mt-1.5 flex flex-col gap-1" data-testid="digest-anomalies">
                  {digest.anomalies.map((a) => (
                    <li key={a.kind} className="flex items-baseline gap-2 text-sm">
                      <span className="mt-0.5 inline-flex min-w-6 shrink-0 justify-center rounded bg-signal/10 px-1.5 font-mono text-xs tabular font-semibold text-signal">
                        {a.count}
                      </span>
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div>
            <CopyDigestButton text={digestText} />
          </div>
        </div>
      </Section>
    </div>
  );
}

function qs(params: Record<string, string | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  return p.toString();
}
