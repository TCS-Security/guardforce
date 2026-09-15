"use client";

import { ClipboardClock, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/gf/button-link";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { Eyebrow } from "@/components/gf/eyebrow";
import { MARKER_STYLE } from "./live-map";
import { presenceState, type PresenceState } from "@/lib/domain/status";
import { fmtAgo, fmtTime } from "@/lib/domain/format";
import type { LivePresence } from "@/lib/data/live";
import { cn } from "cn";

const STATE_TONE: Record<PresenceState, "present" | "neutral" | "signal"> = {
  live: "present",
  stale: "neutral",
  location_off: "signal",
  off_duty: "neutral",
};

/**
 * Detail card for the guard picked out of the live list. The two actions are real buttons
 * pinned below a scrolling detail area, so they stay reachable however short the viewport is.
 */
export function SelectedGuard({
  presence,
  siteName,
  timezone,
  stalenessMin,
  onClear,
}: {
  presence: LivePresence | null;
  siteName?: string | null;
  timezone: string;
  stalenessMin: number;
  onClear?: () => void;
}) {
  if (!presence) return null;
  const state = presenceState(presence, stalenessMin);
  const name = presence.guards?.full_name ?? "Guard";
  return (
    <div data-testid="selected-guard" className="flex shrink-0 flex-col border-t bg-card">
      <div className="min-h-0 max-h-[34dvh] overflow-y-auto p-3 pb-2.5">
        <div className="flex items-center gap-2">
          <Eyebrow className="flex-1 truncate">Selected guard</Eyebrow>
          <StatusPill tone={STATE_TONE[state]} size="xs">{MARKER_STYLE[state].label}</StatusPill>
          {onClear && (
            <Button variant="ghost" size="icon-xs" onClick={onClear} aria-label={`Clear selection of ${name}`}>
              <X />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span className="relative shrink-0">
            <GuardAvatar name={name} />
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card" style={{ background: MARKER_STYLE[state].color }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            <Mono className="block truncate text-[11px] text-muted-foreground">
              {presence.guards?.employee_code ?? "—"} · {presence.guards?.designation ?? "Guard"}
            </Mono>
            {siteName && <div className="truncate text-[11px] text-muted-foreground">{siteName}</div>}
          </div>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Detail k="Since" v={fmtTime(presence.shifts?.started_at, timezone)} />
          <Detail k="Until" v={fmtTime(presence.shifts?.scheduled_end, timezone)} />
          <Detail k="Battery" v={presence.battery_pct != null ? `${presence.battery_pct}%` : "—"} />
          <Detail k="GPS" v={presence.accuracy_m != null ? `±${Math.round(presence.accuracy_m)} m` : "—"} />
          <Detail k="Fence" v={presence.in_fence === false ? "Outside" : "Inside"} />
          <Detail k="Last seen" v={fmtAgo(presence.last_seen_at)} />
        </dl>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-card p-3">
        {presence.shift_id && (
          <ButtonLink
            href={`/attendance/${presence.shift_id}`}
            size="lg"
            className="h-10 w-full"
            aria-label={`Open shift for ${name}`}
          >
            <ClipboardClock data-icon="inline-start" /> Open shift
          </ButtonLink>
        )}
        <ButtonLink
          href={`/guards/${presence.guard_id}`}
          variant="outline"
          size="lg"
          className={cn("h-10 w-full", !presence.shift_id && "col-span-2")}
          aria-label={`Open guard profile for ${name}`}
        >
          <UserRound data-icon="inline-start" /> Guard profile
        </ButtonLink>
      </div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular">{v}</dd>
    </div>
  );
}
