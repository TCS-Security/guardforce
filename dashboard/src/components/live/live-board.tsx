"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LiveMap, MARKER_STYLE } from "./live-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { Eyebrow } from "@/components/gf/eyebrow";
import { presenceState, type PresenceState } from "@/lib/domain/status";
import { fmtAgo, fmtTime } from "@/lib/domain/format";
import type { LivePresence, LiveSite } from "@/lib/data/live";
import { cn } from "cn";

const STATE_TONE: Record<PresenceState, "present" | "neutral" | "signal"> = {
  live: "present",
  stale: "neutral",
  location_off: "signal",
  off_duty: "neutral",
};

/**
 * Live monitoring surface. Presence rows arrive over Supabase realtime; a slow timer
 * re-evaluates staleness so a guard who simply stops reporting still greys out.
 */
export function LiveBoard({
  sites,
  initialPresence,
  stalenessMin,
  timezone,
  initialSiteId,
}: {
  sites: LiveSite[];
  initialPresence: LivePresence[];
  stalenessMin: number;
  timezone: string;
  initialSiteId: string | null;
}) {
  const [presence, setPresence] = useState(initialPresence);
  const [siteId, setSiteId] = useState<string | null>(initialSiteId);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function refresh() {
      const { data } = await supabase
        .from("guard_presence")
        .select(
          "guard_id,site_id,shift_id,lat,lng,accuracy_m,battery_pct,in_fence,is_mock,location_enabled,last_seen_at,guards(id,full_name,employee_code,designation,phone),shifts(id,started_at,scheduled_end,shift_types(name))",
        )
        .not("shift_id", "is", null);
      if (data) setPresence(data as unknown as LivePresence[]);
    }
    // Realtime pushes changes; the timer re-evaluates staleness and catches anything the
    // socket missed while it was connecting, so a control room never quietly goes stale.
    const channel = supabase
      .channel("live-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "guard_presence" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shifts" }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const id = setInterval(() => {
      setTick((n) => n + 1);
      void refresh();
    }, 30_000);
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return presence
      .filter((p) => (!siteId || p.site_id === siteId))
      .filter((p) => !q || [p.guards?.full_name, p.guards?.employee_code].filter(Boolean).some((v) => v!.toLowerCase().includes(q)))
      .sort((a, b) => (a.guards?.full_name ?? "").localeCompare(b.guards?.full_name ?? ""));
  }, [presence, siteId, query]);

  const counts = useMemo(() => {
    const all = siteId ? presence.filter((p) => p.site_id === siteId) : presence;
    return {
      onDuty: all.length,
      stale: all.filter((p) => presenceState(p, stalenessMin) === "stale").length,
      locationOff: all.filter((p) => !p.location_enabled).length,
      outside: all.filter((p) => p.in_fence === false).length,
    };
  }, [presence, siteId, stalenessMin]);

  const bySite = useMemo(() => {
    const map = new Map<string, LivePresence[]>();
    for (const p of visible) {
      const key = p.site_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [visible]);

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
        <Button variant="ghost" size="icon-sm" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Hide the guard list" : "Show the guard list"}>
          {panelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <div className="flex items-center gap-4">
          <Count label="On duty" value={counts.onDuty} tone="present" />
          <Count label="Outside fence" value={counts.outside} tone={counts.outside ? "half-day" : "neutral"} />
          <Count label="Location off" value={counts.locationOff} tone={counts.locationOff ? "signal" : "neutral"} />
          <Count label="Not seen" value={counts.stale} tone={counts.stale ? "neutral" : "neutral"} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant={siteId ? "outline" : "secondary"} size="sm" onClick={() => { setSiteId(null); setSelected(null); }}>
            All sites
          </Button>
          {sites.map((s) => (
            <Button
              key={s.id}
              variant={siteId === s.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setSiteId(s.id); setSelected(null); }}
              className="hidden lg:inline-flex"
            >
              {s.name.split("—")[0]!.trim()}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <LiveMap
          sites={sites}
          presence={visible}
          stalenessMin={stalenessMin}
          focusSiteId={siteId}
          selectedGuardId={selected}
          onSelectGuard={setSelected}
          timezone={timezone}
          className="absolute inset-0"
        />

        {panelOpen && (
          <aside className="absolute top-3 left-3 bottom-3 z-10 flex w-[310px] flex-col overflow-hidden rounded-lg border bg-card/95 shadow-lg backdrop-blur">
            <div className="border-b p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search on-duty guards" aria-label="Search on-duty guards" className="h-8 pl-8" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium">Nobody on duty</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {siteId ? "No guard has started a shift at this site." : "No guard has started a shift right now."}
                  </p>
                </div>
              ) : (
                [...bySite.entries()].map(([id, rows]) => {
                  const site = sites.find((s) => s.id === id);
                  return (
                    <div key={id}>
                      <div className="sticky top-0 flex items-center justify-between bg-muted/80 px-3 py-1.5 backdrop-blur">
                        <Eyebrow>{site?.name ?? "Unassigned"}</Eyebrow>
                        <Mono className="text-[11px] text-muted-foreground">{rows.length}/{site?.guards_required ?? "?"}</Mono>
                      </div>
                      <ul className="divide-y">
                        {rows.map((p) => {
                          const state = presenceState(p, stalenessMin);
                          const name = p.guards?.full_name ?? "Guard";
                          return (
                            <li key={p.guard_id}>
                              <button
                                type="button"
                                onClick={() => setSelected(p.guard_id === selected ? null : p.guard_id)}
                                aria-pressed={p.guard_id === selected}
                                className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60", p.guard_id === selected && "bg-primary/10")}
                              >
                                <span className="relative">
                                  <GuardAvatar name={name} size="sm" />
                                  <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card" style={{ background: MARKER_STYLE[state].color }} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium">{name}</span>
                                  <Mono className="block truncate text-[11px] text-muted-foreground">
                                    {p.shifts?.shift_types?.name ?? "Shift"} · since {fmtTime(p.shifts?.started_at, timezone)} · {p.battery_pct ?? "?"}%
                                  </Mono>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                  {p.in_fence === false && <StatusPill tone="half-day" size="xs" dot={false}>out</StatusPill>}
                                  {!p.location_enabled && <StatusPill tone="signal" size="xs" dot={false}>loc off</StatusPill>}
                                  <Mono className="text-[10px] text-muted-foreground">{fmtAgo(p.last_seen_at)}</Mono>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>

            {selected && (
              <SelectedGuard presence={visible.find((p) => p.guard_id === selected) ?? null} timezone={timezone} stalenessMin={stalenessMin} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function SelectedGuard({ presence, timezone, stalenessMin }: { presence: LivePresence | null; timezone: string; stalenessMin: number }) {
  if (!presence) return null;
  const state = presenceState(presence, stalenessMin);
  const name = presence.guards?.full_name ?? "Guard";
  return (
    <div className="border-t bg-background/80 p-3">
      <div className="flex items-center gap-2.5">
        <GuardAvatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <Mono className="text-[11px] text-muted-foreground">{presence.guards?.employee_code} · {presence.guards?.designation ?? "Guard"}</Mono>
        </div>
        <StatusPill tone={STATE_TONE[state]} size="xs">{MARKER_STYLE[state].label}</StatusPill>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Detail k="Since" v={fmtTime(presence.shifts?.started_at, timezone)} />
        <Detail k="Until" v={fmtTime(presence.shifts?.scheduled_end, timezone)} />
        <Detail k="Battery" v={presence.battery_pct != null ? `${presence.battery_pct}%` : "—"} />
        <Detail k="GPS" v={presence.accuracy_m != null ? `±${Math.round(presence.accuracy_m)} m` : "—"} />
        <Detail k="Fence" v={presence.in_fence === false ? "Outside" : "Inside"} />
        <Detail k="Last seen" v={fmtAgo(presence.last_seen_at)} />
      </dl>
      <div className="mt-2.5 flex gap-1.5">
        {presence.shift_id && (
          <Link href={`/attendance/${presence.shift_id}`} className="text-xs font-medium text-primary hover:underline">
            Open shift →
          </Link>
        )}
        <Link href={`/guards/${presence.guard_id}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline">
          Guard profile
        </Link>
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

function Count({ label, value, tone }: { label: string; value: number; tone: "present" | "half-day" | "signal" | "neutral" }) {
  const color = { present: "text-present", "half-day": "text-half-day-foreground dark:text-half-day", signal: "text-signal", neutral: "text-foreground" }[tone];
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("font-display tabular text-lg leading-none font-semibold", color)}>{value}</span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}
