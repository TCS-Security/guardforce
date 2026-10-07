"use client";

import { useMemo, useState } from "react";
import { Check, X, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { KvList } from "@/components/gf/kv";
import { Mono } from "@/components/gf/mono";
import { GuardCell } from "./guard-cell";
import { fmtDate, fmtMinutes, fmtTime } from "@/lib/domain/format";
import { DEFAULT_OT_POLICY, overtimePay, weeklyOvertime, type OtEntry, type OtStatus } from "@/lib/preview/overtime";
import { fmtINR } from "@/lib/preview/crew";
import type { Tone } from "@/lib/domain/status";
import { cn } from "cn";

const STATUS: Record<OtStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "half-day" },
  approved: { label: "Approved", tone: "present" },
  declined: { label: "Declined", tone: "absent" },
};

/** Sample wage used to price overtime until guards carry a pay rate. */
const SAMPLE_WAGE = 18200;

export function OvertimeBoard({ initial, today, canDecide }: { initial: OtEntry[]; today: string; canDecide: boolean }) {
  const [entries, setEntries] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const policy = DEFAULT_OT_POLICY;

  const pending = entries.filter((e) => e.status === "pending");
  const month = today.slice(0, 7);
  const approvedMonth = entries.filter((e) => e.status === "approved" && e.date.startsWith(month));
  const approvedMin = approvedMonth.reduce((n, e) => n + e.minutes, 0);
  const weekly = useMemo(() => weeklyOvertime(entries, today), [entries, today]);
  const capMin = policy.weekly_ot_cap_h * 60;
  const overCap = [...weekly.entries()].filter(([, m]) => m > capMin).length;
  const leaders = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.guard.id, e.guard]));
    return [...weekly.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, mins]) => ({ guard: byId.get(id)!, mins }));
  }, [entries, weekly]);

  function decide(ids: string[], status: OtStatus) {
    setEntries((rows) => rows.map((e) => (ids.includes(e.id) ? { ...e, status } : e)));
    toast.success(`${ids.length} ${ids.length === 1 ? "entry" : "entries"} ${status}`, { description: "Preview only — not saved." });
  }

  const clean = pending.filter((e) => !e.flag);
  const decided = entries.filter((e) => e.status !== "pending");
  const HISTORY_ROWS = 20;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Waiting on you" value={pending.length} tone={pending.length ? "signal" : "neutral"} hint={`${pending.filter((e) => e.flag).length} need a second look`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Approved this month" value={fmtMinutes(approvedMin)} hint={`${approvedMonth.length} entries`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Overtime cost" value={fmtINR(overtimePay(approvedMin, SAMPLE_WAGE, policy))} hint={`at ${policy.multiplier}× on a ${fmtINR(SAMPLE_WAGE)} wage`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Over the weekly cap" value={overCap} tone={overCap ? "half-day" : "neutral"} hint={`more than ${policy.weekly_ot_cap_h}h in 7 days`} style={{ ["--i" as string]: 4 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section
          title="Pending approval"
          description="Guards claimed these when they checked out late"
          bodyClassName="p-0"
          actions={canDecide && clean.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => decide(clean.map((e) => e.id), "approved")}>
              <Check data-icon="inline-start" /> Approve {clean.length} unflagged
            </Button>
          )}
          style={{ ["--i" as string]: 5 }}
        >
          {pending.length === 0 ? (
            <EmptyState title="Nothing to approve" description="New overtime appears here when a guard checks out past the rostered end." className="m-4" />
          ) : (
            <ul className="divide-y" aria-label="Pending overtime">
              {pending.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-[200px] flex-1"><GuardCell guard={e.guard} sub={e.guard.site_name ?? undefined} /></div>
                  <div className="min-w-[150px] text-xs">
                    <div className="text-muted-foreground">{fmtDate(e.date, undefined, "EEE d MMM")}</div>
                    <Mono className="text-xs">{fmtTime(e.scheduled_end)} → {fmtTime(e.actual_end)}</Mono>
                  </div>
                  <div className="w-20 font-display text-lg font-semibold whitespace-nowrap tabular">{fmtMinutes(e.minutes)}</div>
                  <div className="min-w-[180px] flex-1 text-xs">
                    {e.reason ? <span>“{e.reason}”</span> : <span className="text-muted-foreground italic">No reason given</span>}
                    {e.flag && (
                      <div className="mt-1">
                        <StatusPill tone="half-day" size="xs"><TriangleAlert className="size-3" /> {e.flag === "no_reason" ? "Ask for a reason" : "Over weekly cap"}</StatusPill>
                      </div>
                    )}
                  </div>
                  {canDecide && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" aria-label={`Decline overtime for ${e.guard.full_name}`} onClick={() => decide([e.id], "declined")}><X /></Button>
                      <Button size="sm" aria-label={`Approve overtime for ${e.guard.full_name}`} onClick={() => decide([e.id], "approved")}><Check data-icon="inline-start" /> Approve</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Most overtime, last 7 days" description={`Cap is ${policy.weekly_ot_cap_h}h a week`} style={{ ["--i" as string]: 6 }}>
            {leaders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overtime this week.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {leaders.map(({ guard, mins }) => {
                  const pct = Math.min(100, (mins / capMin) * 100);
                  return (
                    <li key={guard.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{guard.full_name}</span>
                        <Mono className={cn("text-xs", mins > capMin && "text-signal")}>{fmtMinutes(mins)}</Mono>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", mins > capMin ? "bg-signal" : "bg-primary")} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Section title="Policy" style={{ ["--i" as string]: 7 }}>
            <KvList
              items={[
                { k: "Ordinary hours", v: <><Mono>{policy.weekly_regular_h}h</Mono> a week</> },
                { k: "Overtime cap", v: <><Mono>{policy.weekly_ot_cap_h}h</Mono> a week, flagged past it</> },
                { k: "Rate", v: <><Mono>{policy.multiplier}×</Mono> the ordinary hourly rate</> },
                { k: "Grace", v: <>First <Mono>{policy.grace_min}m</Mono> past shift end is not overtime</> },
              ]}
            />
          </Section>
        </div>
      </div>

      <Section title="Decided, last 14 days" description="Approved and declined entries, newest first" bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Overtime history">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th className="min-w-[200px]">Guard</th>
                <th>Date</th>
                <th>Rostered end → out</th>
                <th className="text-right">Overtime</th>
                <th className="min-w-[200px]">Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(showAll ? decided : decided.slice(0, HISTORY_ROWS)).map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-2.5"><GuardCell guard={e.guard} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(e.date, undefined, "d MMM")}</td>
                  <td className="px-4 py-2.5"><Mono className="text-xs">{fmtTime(e.scheduled_end)} → {fmtTime(e.actual_end)}</Mono></td>
                  <td className="px-4 py-2.5 text-right"><Mono>{fmtMinutes(e.minutes)}</Mono></td>
                  <td className="px-4 py-2.5 text-xs">{e.reason ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5"><StatusPill tone={STATUS[e.status].tone} size="xs">{STATUS[e.status].label}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {decided.length > HISTORY_ROWS && (
          <div className="border-t px-4 py-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${decided.length}`}
            </Button>
          </div>
        )}
      </Section>
    </>
  );
}
