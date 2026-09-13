"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryParams } from "@/components/gf/use-query-params";
import type { FilterSite } from "./filter-bar";

/** Independent site + month controls for the muster roll (it doesn't share the analytics date range). */
export function MusterControls({ sites, site, month }: { sites: FilterSite[]; site: string; month: string }) {
  const { set } = useQueryParams();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="eyebrow">Site</Label>
        <Select value={site || "all"} onValueChange={(v) => set({ musterSite: v === "all" ? null : v })}>
          <SelectTrigger size="sm" className="w-[200px]" aria-label="Muster site">
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
        <Label htmlFor="muster-month" className="eyebrow">Month</Label>
        <Input id="muster-month" type="month" value={month} onChange={(e) => set({ musterMonth: e.target.value })} className="h-7 w-[150px] text-xs" />
      </div>
    </div>
  );
}
