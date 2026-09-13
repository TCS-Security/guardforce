import { CalendarDays, ArrowLeft, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import {
  currentYear, loadBalances, loadGuardOptions, loadHistory, loadPendingInbox, loadSiteOptions,
  loadUpcoming, todayISO, type HistoryFilters,
} from "@/lib/data/leave";
import type { LeaveStatus, LeaveType } from "@/lib/supabase/types";
import { PageHeader } from "@/components/gf/page-header";
import { StatTile } from "@/components/gf/stat-tile";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { LeaveStatusBadge } from "@/components/gf/attendance-badge";
import { ButtonLink } from "@/components/gf/button-link";
import { LogLeaveDialog } from "@/components/leave/log-leave-dialog";
import { PendingLeaveCard } from "@/components/leave/pending-leave-card";
import { LeaveTabs } from "@/components/leave/leave-tabs";
import { HistoryFiltersForm } from "@/components/leave/history-filters";
import { BalanceRow } from "@/components/leave/balance-editor";
import { fmtAgo } from "@/lib/domain/format";
import { fmtLeaveRange, leaveDays } from "@/lib/domain/leave";
import { LEAVE_STATUS, LEAVE_TYPE } from "@/lib/domain/status";

export const dynamic = "force-dynamic";

const STATUSES = Object.keys(LEAVE_STATUS) as LeaveStatus[];
const TYPES = Object.keys(LEAVE_TYPE) as LeaveType[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(sp: { [key: string]: string | string[] | undefined }): HistoryFilters {
  const status = one(sp.status);
  const type = one(sp.type);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    status: status && STATUSES.includes(status as LeaveStatus) ? (status as LeaveStatus) : "all",
    type: type && TYPES.includes(type as LeaveType) ? (type as LeaveType) : "all",
    siteId: one(sp.siteId) ?? "all",
    guardId: one(sp.guardId) ?? "all",
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
    page: Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1),
  };
}

function historyHref(f: HistoryFilters, page: number): string {
  const p = new URLSearchParams({ tab: "history" });
  if (f.status !== "all") p.set("status", f.status);
  if (f.type !== "all") p.set("type", f.type);
  if (f.siteId !== "all") p.set("siteId", f.siteId);
  if (f.guardId !== "all") p.set("guardId", f.guardId);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  p.set("page", String(page));
  return `/leave?${p.toString()}`;
}

export default async function LeavePage({ searchParams }: PageProps<"/leave">) {
  const session = await requireSession();
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab = ["upcoming", "history", "balances"].includes(tabParam ?? "") ? tabParam! : "upcoming";
  const filters = parseFilters(sp);
  const today = todayISO(session);

  const [inbox, upcoming, sites, guardOptions] = await Promise.all([
    loadPendingInbox(session),
    loadUpcoming(session),
    loadSiteOptions(session),
    session.isManager ? loadGuardOptions(session) : Promise.resolve([]),
  ]);

  const [history, balances] = await Promise.all([
    tab === "history" ? loadHistory(session, filters) : Promise.resolve(null),
    tab === "balances" ? loadBalances(session) : Promise.resolve(null),
  ]);

  const onLeaveToday = new Set(upcoming.filter((r) => r.start_date <= today && today <= r.end_date).map((r) => r.guard_id)).size;
  const year = currentYear(session);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Operate · Leave</>}
        title="Leave"
        description={
          inbox.length > 0
            ? <>{inbox.length} request{inbox.length === 1 ? "" : "s"} waiting on a decision.</>
            : <>No leave requests waiting. Approved leave auto-marks roster days on leave (LEAVE-1).</>
        }
        actions={
          <>
            <ButtonLink variant="outline" href="/leave/calendar">
              <CalendarDays data-icon="inline-start" /> Calendar
            </ButtonLink>
            {session.isManager && <LogLeaveDialog guards={guardOptions} />}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Pending decisions" value={inbox.length} tone={inbox.length > 0 ? "signal" : "neutral"} hint="waiting in the inbox" style={{ ["--i" as string]: 1 }} />
        <StatTile label="On approved leave today" value={onLeaveToday} hint="distinct guards" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Upcoming approved" value={upcoming.length} hint="approved leave not yet over" style={{ ["--i" as string]: 3 }} />
      </div>

      {/* Inbox */}
      <Section
        title="Pending"
        description="Approve or decline — the guard is notified, balances and roster update automatically"
        bodyClassName="p-0"
        style={{ ["--i" as string]: 4 }}
      >
        {inbox.length === 0 ? (
          <EmptyState
            title="Inbox zero"
            description="No leave requests are waiting on a decision right now."
            className="m-4"
          />
        ) : (
          <ul className="divide-y">
            {inbox.map((item) => (
              <PendingLeaveCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Section>

      <LeaveTabs tab={tab}>
        {tab === "upcoming" && (
          <Section title="Upcoming approved leave" description="Approved and not yet over, soonest first" bodyClassName="p-0">
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing coming up" description="Approved leave will appear here with its roster impact." className="m-4" />
            ) : (
              <table className="w-full text-sm" aria-label="Upcoming approved leave">
                <thead>
                  <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                    <th className="min-w-[220px]">Guard</th>
                    <th className="min-w-[180px]">Site</th>
                    <th>Type</th>
                    <th className="min-w-[200px]">Dates</th>
                    <th className="min-w-[220px]">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {upcoming.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <GuardAvatar name={r.guard_name ?? "Guard"} src={r.guard_avatar} size="sm" />
                          <div>
                            <div className="font-medium">{r.guard_name ?? "Guard"}</div>
                            {r.guard_code && <div className="text-xs text-muted-foreground"><Mono>{r.guard_code}</Mono></div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{r.site_name ?? "—"}</td>
                      <td className="px-4 py-2.5"><StatusPill tone="neutral" dot={false} size="xs">{LEAVE_TYPE[r.type]}</StatusPill></td>
                      <td className="px-4 py-2.5">
                        {fmtLeaveRange(r.start_date, r.end_date)}
                        <Mono className="ml-1.5 text-muted-foreground">{leaveDays(r.start_date, r.end_date)}d</Mono>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-muted-foreground">
                          {r.decided_by_name ? <>{r.decided_by_name} · {fmtAgo(r.decided_at)}</> : "—"}
                        </div>
                        {r.decision_note && <div className="mt-0.5 truncate text-xs" title={r.decision_note}>“{r.decision_note}”</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {tab === "history" && history && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-card p-4">
              <HistoryFiltersForm filters={filters} sites={sites} guards={guardOptions} />
            </div>
            <Section
              title={`History — ${history.total} request${history.total === 1 ? "" : "s"}`}
              description="Every request in your scope, newest first"
              bodyClassName="p-0"
            >
              {history.rows.length === 0 ? (
                <EmptyState
                  title="No requests match"
                  description="Try clearing the filters — or widen the date range."
                  className="m-4"
                  action={
                    <ButtonLink variant="outline" size="sm" href="/leave?tab=history">Clear filters</ButtonLink>
                  }
                />
              ) : (
                <table className="w-full text-sm" aria-label="Leave history">
                  <thead>
                    <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                      <th className="min-w-[200px]">Guard</th>
                      <th className="min-w-[160px]">Site</th>
                      <th>Type</th>
                      <th className="min-w-[180px]">Dates</th>
                      <th>Status</th>
                      <th className="min-w-[220px]">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.rows.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <GuardAvatar name={r.guard_name ?? "Guard"} src={r.guard_avatar} size="sm" />
                            <div>
                              <div className="font-medium">{r.guard_name ?? "Guard"}</div>
                              {r.guard_code && <div className="text-xs text-muted-foreground"><Mono>{r.guard_code}</Mono></div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">{r.site_name ?? "—"}</td>
                        <td className="px-4 py-2.5"><StatusPill tone="neutral" dot={false} size="xs">{LEAVE_TYPE[r.type]}</StatusPill></td>
                        <td className="px-4 py-2.5">
                          {fmtLeaveRange(r.start_date, r.end_date)}
                          <Mono className="ml-1.5 text-muted-foreground">{leaveDays(r.start_date, r.end_date)}d</Mono>
                        </td>
                        <td className="px-4 py-2.5"><LeaveStatusBadge status={r.status} size="xs" /></td>
                        <td className="px-4 py-2.5">
                          {r.status === "pending" ? (
                            <span className="text-xs text-muted-foreground">requested {fmtAgo(r.created_at)}</span>
                          ) : (
                            <>
                              <div className="text-xs text-muted-foreground">
                                {r.decided_by_name ?? "—"}{r.decided_at ? ` · ${fmtAgo(r.decided_at)}` : ""}
                              </div>
                              {r.decision_note && <div className="mt-0.5 max-w-60 truncate text-xs" title={r.decision_note}>“{r.decision_note}”</div>}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
            <div className="flex items-center justify-between gap-3">
              <Mono className="text-xs text-muted-foreground">
                page {history.page} of {history.pageCount}
              </Mono>
              <div className="flex items-center gap-1.5">
                <ButtonLink variant="outline" size="sm" href={historyHref(filters, history.page - 1)} aria-disabled={history.page <= 1} className={history.page <= 1 ? "pointer-events-none opacity-50" : ""}>
                  <ArrowLeft data-icon="inline-start" /> Prev
                </ButtonLink>
                <ButtonLink variant="outline" size="sm" href={historyHref(filters, history.page + 1)} aria-disabled={history.page >= history.pageCount} className={history.page >= history.pageCount ? "pointer-events-none opacity-50" : ""}>
                  Next <ArrowRight data-icon="inline-end" />
                </ButtonLink>
              </div>
            </div>
          </div>
        )}

        {tab === "balances" && balances && (
          <Section
            title={`Leave balances — ${year}`}
            description={session.isOwner ? "Totals are editable inline; guards without a row get the defaults (12 casual / 15 earned) and a row is created on save" : "Per guard for the current year"}
            bodyClassName="p-0"
          >
            <table className="w-full text-sm" aria-label="Leave balances">
              <thead>
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th className="min-w-[220px]">Guard</th>
                  <th>Casual</th>
                  <th>Earned</th>
                  <th>Unpaid</th>
                  {session.isOwner && <th className="w-32"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {balances.map((g) => (
                  <BalanceRow key={g.guard_id} guard={g} year={year} editable={session.isOwner} />
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </LeaveTabs>
    </div>
  );
}
