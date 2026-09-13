"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Shared day + site filter used by the patrol board and the task report. */
export function DayFilter({
  date,
  siteId,
  sites,
  basePath,
}: {
  date: string;
  siteId: string | null;
  sites: { id: string; name: string }[];
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(key: string, value: string | null) {
    const q = new URLSearchParams(params.toString());
    if (value && value !== "all") q.set(key, value);
    else q.delete(key);
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  function shiftDay(days: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    set("date", d.toISOString().slice(0, 10));
  }

  return (
    <div className="reveal flex flex-wrap items-end gap-3" data-base={basePath}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="day" className="eyebrow">Day</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous day" onClick={() => shiftDay(-1)}>‹</Button>
          <Input id="day" type="date" value={date} onChange={(e) => set("date", e.target.value)} className="h-7 w-[140px]" />
          <Button variant="outline" size="icon-sm" aria-label="Next day" onClick={() => shiftDay(1)}>›</Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="eyebrow">Site</Label>
        <Select value={siteId ?? "all"} onValueChange={(v) => set("site", v as string)}>
          <SelectTrigger size="sm" className="w-[220px]" aria-label="Site">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
