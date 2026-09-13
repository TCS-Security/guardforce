"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { cn } from "cn";

type Row = {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  actor_name: string;
  when: string;
};

const DESTRUCTIVE = ["attendance_override", "site_deactivated", "team_member_deactivated", "guard_deactivated"];

/** One audit entry; expands to a before/after JSON diff. */
export function AuditRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!row.before || !!row.after || !!row.reason;

  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        className={cn("flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors", hasDetail && "hover:bg-muted/40")}
      >
        <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90", !hasDetail && "opacity-0")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{row.action.replace(/_/g, " ")}</span>
            <StatusPill tone={DESTRUCTIVE.includes(row.action) ? "half-day" : "neutral"} size="xs" dot={false}>{row.entity_type}</StatusPill>
          </div>
          {row.reason && <p className="mt-0.5 text-xs text-muted-foreground">“{row.reason}”</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs">{row.actor_name}</div>
          <Mono className="text-[11px] text-muted-foreground">{row.when}</Mono>
        </div>
      </button>
      {open && (
        <div className="grid gap-3 border-t bg-muted/30 px-4 py-3 sm:grid-cols-2">
          <JsonBlock label="Before" value={row.before} />
          <JsonBlock label="After" value={row.after} />
        </div>
      )}
    </li>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <pre className="max-h-52 overflow-auto rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}
