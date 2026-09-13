"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/gf/status-pill";
import { EVENT_META, SEVERITY_TONE } from "@/lib/domain/status";
import { fmtAgo } from "@/lib/domain/format";
import type { EventSeverity, EventType } from "@/lib/supabase/types";
import { cn } from "cn";

export type AlertRow = {
  id: string;
  type: EventType;
  severity: EventSeverity;
  title: string;
  payload: Record<string, unknown> | unknown;
  created_at: string;
  site_id: string | null;
  guard_id: string | null;
  shift_id: string | null;
  acknowledged_at: string | null;
  sites: { name: string } | null;
  guards: { full_name: string } | null;
};

/** Warn/critical events, newest first, updated live over Supabase realtime. */
export function LiveAlerts({ initial }: { initial: AlertRow[] }) {
  const [rows, setRows] = useState<AlertRow[]>(initial);
  const supabase = createClient();

  useEffect(() => {
    const ch = supabase
      .channel("overview-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, async (payload) => {
        const ev = payload.new as { id: string; severity: EventSeverity };
        if (ev.severity === "info") return;
        const { data } = await supabase
          .from("events")
          .select("id,type,severity,title,payload,created_at,site_id,guard_id,shift_id,acknowledged_at,sites(name),guards(full_name)")
          .eq("id", ev.id)
          .single();
        if (data) setRows((r) => [data as AlertRow, ...r].slice(0, 14));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (rows.length === 0) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">All quiet. No warnings today.</div>;
  }

  return (
    <ul className="divide-y">
      {rows.map((e, i) => {
        const href = e.shift_id ? `/attendance/${e.shift_id}` : e.guard_id ? `/guards/${e.guard_id}` : "/events";
        const body = (e.payload as { body?: string } | null)?.body;
        return (
          <li key={e.id} className={cn("reveal", i === 0 && "bg-signal/[0.04]")} style={{ ["--i" as string]: i }}>
            <Link href={href} className="flex gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60">
              <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", e.severity === "critical" ? "bg-absent" : "bg-half-day")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-[13px] font-medium">{e.title}</div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{fmtAgo(e.created_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusPill tone={SEVERITY_TONE[e.severity]} dot={false} size="xs">{EVENT_META[e.type].label}</StatusPill>
                  <span className="truncate">{e.sites?.name ?? "—"}{body ? ` · ${body}` : ""}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
