"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DayStepper, FilterBar, FilterField, FilterSearch } from "@/components/gf/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ATTENDANCE_STATUS_FILTERS as STATUSES,
  TRUST_FILTERS as TRUST,
  normalizeStatusFilter,
  normalizeTrustFilter,
} from "@/lib/domain/attendance";

export function AttendanceFilters({
  sites,
  current,
}: {
  sites: { id: string; name: string }[];
  current: { date: string; siteId: string | null; status: string | null; trust: string | null; q: string | null };
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
    <FilterBar aria-label="Filter attendance">
      <FilterField label="Date" htmlFor="att-date">
        <DayStepper id="att-date" value={current.date} onChange={(d) => set("date", d)} />
      </FilterField>

      <FilterField label="Site">
        <Select value={current.siteId ?? "all"} onValueChange={(v) => set("site", v as string)}>
          <SelectTrigger className="w-[200px]" aria-label="Site">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Attendance">
        <Select value={normalizeStatusFilter(current.status)} onValueChange={(v) => set("status", v as string)}>
          <SelectTrigger className="w-[170px]" aria-label="Attendance status">
            <SelectValue>{(v: string) => STATUSES.find((s) => s.value === (v || "all"))?.label ?? "Any status"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Trust">
        <Select value={normalizeTrustFilter(current.trust)} onValueChange={(v) => set("trust", v as string)}>
          <SelectTrigger className="w-[170px]" aria-label="Trust level">
            <SelectValue>{(v: string) => TRUST.find((s) => s.value === (v || "all"))?.label ?? "Any trust"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TRUST.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Search" htmlFor="att-search" className="min-w-[200px] flex-1 sm:max-w-xs">
        <FilterSearch
          id="att-search"
          defaultValue={current.q ?? ""}
          onChange={(e) => set("q", e.target.value || null)}
          placeholder="Search guard or code"
          aria-label="Search guards"
        />
      </FilterField>
    </FilterBar>
  );
}
