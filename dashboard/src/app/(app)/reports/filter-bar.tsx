"use client";

import { format, startOfMonth, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useQueryParams } from "@/components/gf/use-query-params";

export type FilterSite = { id: string; name: string };
export type FilterGuard = { id: string; full_name: string; site_id: string | null };

const PRESETS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
] as const;

function presetRange(key: (typeof PRESETS)[number]["key"]) {
  const today = new Date();
  const to = format(today, "yyyy-MM-dd");
  if (key === "7d") return { from: format(subDays(today, 6), "yyyy-MM-dd"), to };
  if (key === "30d") return { from: format(subDays(today, 29), "yyyy-MM-dd"), to };
  return { from: format(startOfMonth(today), "yyyy-MM-dd"), to };
}

/** Site, guard and date-range controls shared by analytics, scorecards and the CSV export links below. */
export function ReportFilterBar({
  sites,
  guards,
  current,
}: {
  sites: FilterSite[];
  guards: FilterGuard[];
  current: { site: string; guard: string; from: string; to: string; preset: string };
}) {
  const { set } = useQueryParams();
  const filteredGuards = current.site ? guards.filter((g) => g.site_id === current.site) : guards;

  return (
    <div className="reveal flex flex-col gap-3 rounded-lg border bg-card p-4" style={{ ["--i" as string]: 1 }}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="eyebrow">Site</Label>
          <Select value={current.site || "all"} onValueChange={(v) => set({ site: v === "all" ? null : v, guard: null })}>
            <SelectTrigger size="sm" className="w-[200px]" aria-label="Site">
              <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="eyebrow">Guard</Label>
          <Select value={current.guard || "all"} onValueChange={(v) => set({ guard: v === "all" ? null : v })}>
            <SelectTrigger size="sm" className="w-[200px]" aria-label="Guard">
              <SelectValue>{(v: string) => (!v || v === "all" ? "All guards" : (filteredGuards.find((g) => g.id === v)?.full_name ?? "All guards"))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All guards</SelectItem>
              {filteredGuards.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="eyebrow">From</Label>
          <Input type="date" value={current.from} onChange={(e) => set({ from: e.target.value, preset: "custom" })} className="h-7 w-[150px] text-xs" aria-label="From date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="eyebrow">To</Label>
          <Input type="date" value={current.to} onChange={(e) => set({ to: e.target.value, preset: "custom" })} className="h-7 w-[150px] text-xs" aria-label="To date" />
        </div>
        <div className="flex flex-1 items-end justify-end gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={current.preset === p.key ? "secondary" : "outline"}
              onClick={() => set({ preset: p.key, ...presetRange(p.key) })}
              className={cn(current.preset === p.key && "font-semibold")}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
