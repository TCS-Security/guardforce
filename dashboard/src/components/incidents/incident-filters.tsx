"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_STATUSES,
  INCIDENT_TYPE,
  INCIDENT_TYPES,
  type IncidentFilters,
} from "@/lib/domain/incidents";

export function IncidentFiltersBar({ filters, sites }: { filters: IncidentFilters; sites: { id: string; name: string }[] }) {
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
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  return (
    <div className="reveal flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3" style={{ ["--i" as string]: 1 }}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-from" className="eyebrow">From</Label>
        <Input id="inc-from" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="h-7 w-[140px]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-to" className="eyebrow">To</Label>
        <Input id="inc-to" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="h-7 w-[140px]" />
      </div>

      <Picker
        label="Site"
        value={filters.siteId ?? "all"}
        onChange={(v) => set({ site: v })}
        options={[{ value: "all", label: "All sites" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
        width="w-[200px]"
      />
      <Picker
        label="Type"
        value={filters.type ?? "all"}
        onChange={(v) => set({ type: v })}
        options={[{ value: "all", label: "Any type" }, ...INCIDENT_TYPES.map((t) => ({ value: t, label: INCIDENT_TYPE[t].label }))]}
        width="w-[190px]"
      />
      <Picker
        label="Severity"
        value={filters.severity ?? "all"}
        onChange={(v) => set({ severity: v })}
        options={[{ value: "all", label: "Any severity" }, ...INCIDENT_SEVERITIES.map((s) => ({ value: s, label: INCIDENT_SEVERITY[s].label }))]}
        width="w-[150px]"
      />
      <Picker
        label="Status"
        value={filters.status ?? "all"}
        onChange={(v) => set({ status: v })}
        options={[
          { value: "all", label: "Any status" },
          { value: "unresolved", label: "Still open" },
          ...INCIDENT_STATUSES.map((s) => ({ value: s, label: INCIDENT_STATUS[s].label })),
        ]}
        width="w-[160px]"
      />
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
