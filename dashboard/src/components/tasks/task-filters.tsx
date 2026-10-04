"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { FilterBar, FilterField } from "@/components/gf/filter-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS = [
  { value: "all", label: "Any status" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "missed", label: "Missed" },
];

const DUE = [
  { value: "all", label: "Any time" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
];

export function TaskFiltersBar({
  sites,
  guards,
  current,
}: {
  sites: { id: string; name: string }[];
  guards: { id: string; full_name: string }[];
  current: { siteId: string | null; status: string | null; due: string | null; guardId: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(key: string, value: string) {
    const q = new URLSearchParams(params.toString());
    if (value && value !== "all") q.set(key, value);
    else q.delete(key);
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  const options = [
    { key: "site", label: "Site", value: current.siteId ?? "all", items: [{ value: "all", label: "All sites" }, ...sites.map((s) => ({ value: s.id, label: s.name }))], width: "w-[210px]" },
    { key: "status", label: "Status", value: current.status ?? "all", items: STATUS, width: "w-[140px]" },
    { key: "due", label: "Due", value: current.due ?? "all", items: DUE, width: "w-[140px]" },
    { key: "guard", label: "Assignee", value: current.guardId ?? "all", items: [{ value: "all", label: "Anyone" }, ...guards.map((g) => ({ value: g.id, label: g.full_name }))], width: "w-[170px]" },
  ];

  return (
    <FilterBar aria-label="Filter tasks">
      {options.map((o) => (
        <FilterField key={o.key} label={o.label}>
          <Select value={o.value} onValueChange={(v) => set(o.key, v as string)}>
            <SelectTrigger className={o.width} aria-label={o.label}>
              <SelectValue>{(v: string) => o.items.find((i) => i.value === (v || "all"))?.label ?? o.items[0]!.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {o.items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      ))}
    </FilterBar>
  );
}
