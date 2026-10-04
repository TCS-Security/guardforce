"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { EVENT_META, SEVERITY_TONE } from "@/lib/domain/status";
import { fmtDistance } from "@/lib/domain/format";
import type { EventRow as Row } from "@/lib/data/events";
import { cn } from "cn";

/** Human-readable payload lines — the fields worth reading, not raw JSON. */
function payloadLines(payload: Record<string, unknown>) {
  const lines: string[] = [];
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  if (payload.distance_m != null) lines.push(`${fmtDistance(num(payload.distance_m))} from the fence`);
  if (payload.late_by_min != null) lines.push(`${num(payload.late_by_min)} min late`);
  if (payload.worked_minutes != null) lines.push(`${num(payload.worked_minutes)} min worked`);
  if (payload.location_off_seconds != null) lines.push(`location off for ${Math.round(num(payload.location_off_seconds) / 60)} min`);
  if (payload.photos != null) lines.push(`${num(payload.photos)} photo(s)`);
  if (payload.reason) lines.push(String(payload.reason));
  if (payload.body && !lines.length) lines.push(String(payload.body));
  return lines;
}

export function EventRow({ event, time }: { event: Row; time: string }) {
  const [open, setOpen] = useState(false);
  const meta = EVENT_META[event.type];
  const lines = payloadLines(event.payload ?? {});
  const href = event.shift_id ? `/attendance/${event.shift_id}` : event.guard_id ? `/guards/${event.guard_id}` : null;

  return (
    <li className={cn("grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-2.5", !event.acknowledged_at && event.severity !== "info" && "bg-signal/[0.04]")}>
      <div className="flex items-center gap-2 pt-0.5">
        <span
          className={cn("size-1.5 rounded-full", event.severity === "critical" ? "bg-absent" : event.severity === "warn" ? "bg-half-day" : "bg-muted-foreground/40")}
          aria-hidden
        />
        <Mono className="w-12 text-muted-foreground">{time}</Mono>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="text-[13px] font-medium hover:underline">{event.title}</Link>
          ) : (
            <span className="text-[13px] font-medium">{event.title}</span>
          )}
          <StatusPill tone={SEVERITY_TONE[event.severity]} size="xs" dot={false}>{meta?.label ?? event.type}</StatusPill>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{event.sites?.name ?? "Agency"}</span>
          {event.guards?.full_name && <span>· {event.guards.full_name}</span>}
          {/* The distinguishing detail of a repeated alert ("Expected 20:04"): mono and
              unmuted, because three missed rounds are otherwise the same row three times. */}
          {lines.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-px font-mono tabular text-[11px] text-foreground whitespace-nowrap">{lines[0]}</span>
          )}
          {lines.length > 1 && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-0.5 hover:text-foreground">
              <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} /> more
            </button>
          )}
        </div>
        {open && (
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {lines.slice(1).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </div>

      <div className="pt-0.5">
        {event.acknowledged_at ? (
          <StatusPill tone="neutral" size="xs" dot={false}>seen</StatusPill>
        ) : event.severity !== "info" ? (
          <StatusPill tone={SEVERITY_TONE[event.severity]} size="xs">open</StatusPill>
        ) : null}
      </div>
    </li>
  );
}
