import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { defaultAttendanceDate, loadAttendanceDay } from "@/lib/data/attendance";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { AttendanceBadge, TrustBadge } from "@/components/gf/attendance-badge";
import { AttendanceFilters } from "./filters";
import { FLAG_LABELS } from "@/lib/domain/status";
import { fmtMinutes, fmtSeconds, fmtTime } from "@/lib/domain/format";
import { cn } from "cn";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const session = await requireSession();
  requirePermission(session, "attendance:read");
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

  const filters = {
    date: str(sp.date) ?? defaultAttendanceDate(session),
    siteId: str(sp.site),
    attendance: str(sp.status),
    trust: str(sp.trust),
    q: str(sp.q),
  };
  const { rows, sites, summary } = await loadAttendanceDay(session, filters);
  const live = rows.filter((r) => r.status === "in_progress");

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <PageHeader
        eyebrow="The money path"
        title="Attendance"
        description="A shift counts when the guard sent a selfie from inside the fence and kept location on."
      />

      <AttendanceFilters sites={sites} current={filters} />

      <div className="reveal grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" style={{ ["--i" as string]: 1 }}>
        <Tally label="On duty" value={summary.on_duty} tone="present" />
        <Tally label="Present" value={summary.present} />
        <Tally label="Half day" value={summary.half_day} tone={summary.half_day ? "half-day" : "neutral"} />
        <Tally label="Absent" value={summary.absent} tone={summary.absent ? "absent" : "neutral"} />
        <Tally label="On leave" value={summary.on_leave} tone="on-leave" />
        <Tally label="Flagged" value={summary.flagged} tone={summary.flagged ? "half-day" : "neutral"} />
        <Tally label="Void" value={summary.void} tone={summary.void ? "absent" : "neutral"} />
      </div>

      {live.length > 0 && (
        <Section title={`On duty now (${live.length})`} bodyClassName="p-0" style={{ ["--i" as string]: 2 }}>
          <ul className="divide-y">
            {live.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <GuardAvatar name={r.guards?.full_name ?? "Guard"} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/attendance/${r.id}`} className="text-sm font-medium hover:underline">{r.guards?.full_name}</Link>
                  <Mono className="ml-2 text-muted-foreground">
                    {r.sites?.name} · in {fmtTime(r.start_captured_at ?? r.started_at, session.agency.timezone)}
                    {r.away_seconds > 0 ? ` · away ${fmtSeconds(r.away_seconds)}` : ""}
                  </Mono>
                </div>
                {!r.location_enabled && <StatusPill tone="absent" size="xs">location off</StatusPill>}
                <TrustBadge trust={r.trust as never} size="xs" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Shifts on ${filters.date}`} description={`${rows.length} row${rows.length === 1 ? "" : "s"}`} bodyClassName="p-0" style={{ ["--i" as string]: 3 }}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title="Nothing rostered for this filter"
            description="Change the date or clear the filters to see other shifts."
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm" aria-label="Attendance">
              <thead>
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>Guard</th>
                  <th>Site & shift</th>
                  <th>In</th>
                  <th>Out</th>
                  <th className="text-right">Worked</th>
                  <th className="text-right">Away</th>
                  <th>Flags</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="group hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <GuardAvatar name={r.guards?.full_name ?? "Guard"} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/attendance/${r.id}`} className="block truncate font-medium hover:underline">
                            {r.guards?.full_name ?? "Guard"}
                          </Link>
                          <Mono className="text-muted-foreground">{r.guards?.employee_code}</Mono>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="truncate text-muted-foreground">{r.sites?.name}</div>
                      <Mono className="text-muted-foreground">
                        {r.shift_types?.name ?? "Ad hoc"} {r.scheduled_start ? fmtTime(r.scheduled_start, session.agency.timezone) : "—"}
                        {r.scheduled_end ? `–${fmtTime(r.scheduled_end, session.agency.timezone)}` : ""}
                      </Mono>
                    </td>
                    <td className="px-4 py-2">
                      <Mono className={cn(r.late_by_min > session.agency.late_threshold_min && "text-half-day-foreground dark:text-half-day")}>
                        {fmtTime(r.start_captured_at ?? r.started_at, session.agency.timezone)}
                      </Mono>
                      {r.late_by_min > 0 && <div className="font-mono text-[10px] text-muted-foreground">+{r.late_by_min}m late</div>}
                    </td>
                    <td className="px-4 py-2"><Mono>{fmtTime(r.end_captured_at ?? r.ended_at, session.agency.timezone)}</Mono></td>
                    <td className="px-4 py-2 text-right"><Mono>{r.worked_minutes ? fmtMinutes(r.worked_minutes) : "—"}</Mono></td>
                    <td className="px-4 py-2 text-right">
                      <Mono className={cn(r.away_seconds > 1800 && "text-half-day-foreground dark:text-half-day")}>
                        {r.away_seconds ? fmtSeconds(r.away_seconds) : "—"}
                      </Mono>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.flags.slice(0, 3).map((f) => (
                          <StatusPill key={f} tone={f === "LOCATION_OFF" || f === "TAMPER_SUSPECTED" ? "absent" : "half-day"} size="xs" dot={false}>
                            {FLAG_LABELS[f] ?? f}
                          </StatusPill>
                        ))}
                        {r.flags.length > 3 && <span className="text-xs text-muted-foreground">+{r.flags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.exception_id && <StatusPill tone="olive" size="xs" dot={false}>exception</StatusPill>}
                        {r.override_attendance && <StatusPill tone="olive" size="xs" dot={false}>corrected</StatusPill>}
                        <TrustBadge trust={r.trust as never} size="xs" />
                        <AttendanceBadge status={r.attendance as never} size="xs" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Tally({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "present" | "half-day" | "absent" | "on-leave" }) {
  const color = {
    neutral: "text-foreground",
    present: "text-present",
    "half-day": "text-half-day-foreground dark:text-half-day",
    absent: "text-absent",
    "on-leave": "text-on-leave",
  }[tone];
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className={cn("font-display tabular text-xl leading-tight font-semibold", color)}>{value}</div>
    </div>
  );
}
