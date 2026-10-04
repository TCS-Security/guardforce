"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DayStepper, FilterBar, FilterField } from "@/components/gf/filter-bar";
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

  return (
    <FilterBar data-base={basePath} aria-label="Filter by day and site">
      <FilterField label="Day" htmlFor="day">
        <DayStepper id="day" value={date} onChange={(d) => set("date", d)} />
      </FilterField>
      <FilterField label="Site">
        <Select value={siteId ?? "all"} onValueChange={(v) => set("site", v as string)}>
          <SelectTrigger className="w-[220px]" aria-label="Site">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
    </FilterBar>
  );
}
