"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_META } from "@/lib/domain/status";
import type { EventType } from "@/lib/supabase/types";
import type { EventFilters } from "@/lib/data/events";

const GROUPS = [
  { value: "all", label: "All activity" },
  { value: "attendance", label: "Attendance" },
  { value: "location", label: "Location" },
  { value: "patrol", label: "Patrols" },
  { value: "task", label: "Tasks" },
  { value: "leave", label: "Leave" },
  { value: "admin", label: "Admin" },
];

const SEVERITIES = [
  { value: "all", label: "Any severity" },
  { value: "critical", label: "Critical" },
  { value: "warn", label: "Warning" },
  { value: "info", label: "Info" },
];

export function EventFiltersBar({
  filters,
  sites,
  guards,
}: {
  filters: EventFilters;
  sites: { id: string; name: string }[];
  guards: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== "all") q.set(k, v);
      else q.delete(k);
    }
    q.delete("page");
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  const types = filters.group
    ? (Object.keys(EVENT_META) as EventType[]).filter((t) => EVENT_META[t].group === filters.group)
    : (Object.keys(EVENT_META) as EventType[]);

  return (
    <div className="reveal flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-from" className="eyebrow">From</Label>
        <Input id="ev-from" type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value })} className="h-7 w-[140px]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ev-to" className="eyebrow">To</Label>
        <Input id="ev-to" type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value })} className="h-7 w-[140px]" />
      </div>

      <Picker
        label="Site"
        value={filters.siteId ?? "all"}
        onChange={(v) => set({ site: v })}
        options={[{ value: "all", label: "All sites" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
        width="w-[190px]"
      />
      <Picker
        label="Guard"
        value={filters.guardId ?? "all"}
        onChange={(v) => set({ guard: v })}
        options={[{ value: "all", label: "All guards" }, ...guards.map((g) => ({ value: g.id, label: g.full_name }))]}
        width="w-[170px]"
      />
      <Picker label="Activity" value={filters.group ?? "all"} onChange={(v) => set({ group: v, type: null })} options={GROUPS} width="w-[150px]" />
      <Picker
        label="Type"
        value={filters.type ?? "all"}
        onChange={(v) => set({ type: v })}
        options={[{ value: "all", label: "Any type" }, ...types.map((t) => ({ value: t, label: EVENT_META[t].label }))]}
        width="w-[170px]"
      />
      <Picker label="Severity" value={filters.severity ?? "all"} onChange={(v) => set({ severity: v })} options={SEVERITIES} width="w-[140px]" />
      <Picker
        label="Status"
        value={filters.ack}
        onChange={(v) => set({ ack: v })}
        options={[
          { value: "all", label: "All" },
          { value: "open", label: "Unacknowledged" },
          { value: "acknowledged", label: "Acknowledged" },
        ]}
        width="w-[160px]"
      />

      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        nativeButton={false}
        render={<a href={`/events/export?${params.toString()}`} download />}
      >
        <Download data-icon="inline-start" /> CSV
      </Button>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="eyebrow">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger size="sm" className={width} aria-label={label}>
          <SelectValue>{(v: string) => options.find((o) => o.value === (v || "all"))?.label ?? options[0]!.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
