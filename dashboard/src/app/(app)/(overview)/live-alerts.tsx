"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/gf/status-pill";
import { EVENT_META, SEVERITY_TONE } from "@/lib/domain/status";
import { fmtAgo } from "@/lib/domain/format";
import {
  ALERT_FEED_LIMIT,
  alertDetail,
  alertEventHref,
  groupAlerts,
  mergeAlert,
  type AlertEvent,
  type AlertGroup,
} from "@/lib/domain/alerts";
import type { EventSeverity } from "@/lib/supabase/types";
import { cn } from "cn";

export type AlertRow = AlertEvent;

const SELECT = "id,type,severity,title,payload,created_at,site_id,guard_id,shift_id,acknowledged_at,sites(name),guards(full_name)";

/**
 * Warn/critical events, newest first, updated live over Supabase realtime.
 *
 * Rows are grouped (see `@/lib/domain/alerts`): repeats of the same problem for the same guard
 * collapse into one line carrying a count and the latest time, so a guard who skipped three
 * rounds no longer crowds three of the panel's slots.
 */
export function LiveAlerts({ initial }: { initial: AlertRow[] }) {
  const [groups, setGroups] = useState<AlertGroup[]>(() => groupAlerts(initial, ALERT_FEED_LIMIT));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  useEffect(() => {
    const ch = supabase
      .channel("overview-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, async (payload) => {
        const ev = payload.new as { id: string; severity: EventSeverity };
        if (ev.severity === "info") return;
        const { data } = await supabase.from("events").select(SELECT).eq("id", ev.id).single();
        // Same pure function as the first render, so a new round for a guard already on the
        // panel bumps that row's count instead of adding a look-alike.
        if (data) setGroups((g) => mergeAlert(g, data as unknown as AlertEvent, ALERT_FEED_LIMIT));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (groups.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">All quiet. No warnings today.</div>;
  }

  return (
    <ul className="divide-y" data-testid="live-alerts">
      {groups.map((g, i) => {
        const open = expanded[g.key] ?? false;
        return (
          <li
            key={g.key}
            data-testid="alert-group"
            data-count={g.count}
            className={cn("reveal px-4 py-2.5 transition-colors hover:bg-muted/60", i === 0 && "bg-signal/[0.04]")}
            style={{ ["--i" as string]: i }}
          >
            <div className="flex gap-3">
              <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", g.severity === "critical" ? "bg-absent" : "bg-half-day")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={g.href} className="truncate text-[13px] font-medium underline-offset-2 hover:underline">
                    {g.headline}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{fmtAgo(g.latest.created_at)}</span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <StatusPill tone={SEVERITY_TONE[g.severity]} dot={false} size="xs">{EVENT_META[g.latest.type].label}</StatusPill>
                  {g.count > 1 && (
                    <StatusPill tone="signal" dot={false} size="xs" className="font-mono tabular">×{g.count}</StatusPill>
                  )}
                  {g.detail && (
                    <span className="max-w-full min-w-0 truncate rounded bg-muted px-1.5 py-px font-mono tabular text-[11px]" title={g.detail}>{g.detail}</span>
                  )}
                  <span className="min-w-0 truncate text-muted-foreground">{g.siteName ?? "—"}</span>
                </div>

                {g.count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [g.key]: !open }))}
                      aria-expanded={open}
                      className="mt-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
                      {open ? "Hide" : `All ${g.count}`}
                    </button>
                    {open && (
                      <ul className="mt-1 space-y-1 border-l pl-2.5">
                        {g.events.map((e) => (
                          <li key={e.id} className="flex items-baseline justify-between gap-2 text-xs">
                            <Link href={alertEventHref(e)} className="truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                              <span className="font-mono tabular">{alertDetail(e) ?? e.title}</span>
                            </Link>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{fmtAgo(e.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
