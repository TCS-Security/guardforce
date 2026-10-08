"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Columns3, List, Search, Sparkles, Users } from "lucide-react";
import { cn } from "cn";
import { FilterBar, FilterField, FilterSearch } from "@/components/gf/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SEGMENTS, STAGES } from "@/lib/domain/sales";
import type { SalesFilters, SalesTab } from "@/lib/data/sales";

const TABS: { key: SalesTab; label: string; icon: typeof List }[] = [
  { key: "today", label: "Today", icon: CalendarClock },
  { key: "leads", label: "My leads", icon: Users },
  { key: "find", label: "Find new leads", icon: Sparkles },
];

export function SalesToolbar({
  tab,
  view,
  filters,
  near,
  team,
}: {
  tab: SalesTab;
  view: "list" | "board";
  filters: SalesFilters;
  near: boolean;
  team: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete("lead");
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function tabHref(key: SalesTab) {
    const next = new URLSearchParams();
    if (key !== "leads") next.set("tab", key);
    return `/sales${next.size ? `?${next}` : ""}`;
  }

  const selects = [
    {
      key: "label", label: "Hot / Warm / Cold", value: filters.label ?? "all", width: "w-[150px]",
      items: [{ value: "all", label: "All" }, { value: "hot", label: "Hot" }, { value: "warm", label: "Warm" }, { value: "cold", label: "Cold" }],
    },
    {
      key: "segment", label: "Type", value: filters.segment ?? "all", width: "w-[170px]",
      items: [
        { value: "all", label: "All types" },
        ...Object.entries(SEGMENTS)
          .filter(([k]) => tab !== "find" || k !== "agency")
          .map(([k, v]) => ({ value: k, label: v.label })),
      ],
    },
    ...(tab === "find"
      ? []
      : [
          {
            key: "stage", label: "Stage", value: filters.stage ?? "all", width: "w-[140px]",
            items: [{ value: "all", label: "Any stage" }, ...STAGES.map((s) => ({ value: s.key, label: s.label }))],
          },
          {
            key: "owner", label: "Owner", value: filters.owner ?? "all", width: "w-[170px]",
            items: [
              { value: "all", label: "Anyone" },
              { value: "me", label: "Me" },
              { value: "none", label: "Nobody yet" },
              ...team.map((t) => ({ value: t.id, label: t.full_name })),
            ],
          },
        ]),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="reveal flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Sales sections" className="flex rounded-lg border bg-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
        {tab === "leads" && (
          <div className="flex rounded-lg border bg-card p-1" role="group" aria-label="Show as">
            {(["list", "board"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set({ view: v === "board" ? "board" : null })}
                aria-pressed={view === v}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                  view === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "list" ? <List className="size-4" /> : <Columns3 className="size-4" />}
                {v === "list" ? "List" : "Board"}
              </button>
            ))}
          </div>
        )}
      </div>

      <FilterBar aria-label="Filter leads">
        <FilterField label="Search">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              set({ q: q.trim() || null });
            }}
          >
            <FilterSearch
              className="w-[220px]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => q.trim() !== (filters.q ?? "") && set({ q: q.trim() || null })}
              placeholder={tab === "find" ? "Name, area, developer" : "Name, area, agency"}
              aria-label="Search leads"
            />
            <button type="submit" className="sr-only"><Search /> Search</button>
          </form>
        </FilterField>
        {selects.map((o) => (
          <FilterField key={o.key} label={o.label}>
            <Select value={o.value} onValueChange={(v) => set({ [o.key]: v as string })}>
              <SelectTrigger className={o.width} aria-label={o.label}>
                <SelectValue>{(v: string) => o.items.find((i) => i.value === (v || "all"))?.label ?? o.items[0]!.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {o.items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
        ))}
        {tab === "find" && (
          <FilterField label="Near my sites">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={near} onCheckedChange={(v) => set({ near: v ? "1" : null })} aria-label="Only near my sites" />
              <span className="text-muted-foreground">Within 3 km</span>
            </label>
          </FilterField>
        )}
      </FilterBar>
    </div>
  );
}
