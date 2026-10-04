"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { FilterBar, FilterField } from "@/components/gf/filter-bar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AuditFilters({
  entityTypes,
  actors,
  current,
}: {
  entityTypes: string[];
  actors: { id: string; full_name: string }[];
  current: { entityType: string | null; actorId: string | null; from: string | null; to: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const hasFilters = !!(current.entityType || current.actorId || current.from || current.to);

  return (
    <FilterBar aria-label="Filter the audit log">
      <FilterField label="Entity" htmlFor="entity">
        <Select value={current.entityType ?? "all"} onValueChange={(v) => set("entity", v as string)}>
          <SelectTrigger id="entity" className="w-40">
            <SelectValue>{(v) => (v === "all" ? "All entities" : String(v))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Actor" htmlFor="actor">
        <Select value={current.actorId ?? "all"} onValueChange={(v) => set("actor", v as string)}>
          <SelectTrigger id="actor" className="w-48">
            <SelectValue>{(v) => (v === "all" ? "Anyone" : actors.find((a) => a.id === v)?.full_name ?? "Anyone")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="From" htmlFor="from">
        <Input id="from" type="date" defaultValue={current.from ?? ""} onChange={(e) => set("from", e.target.value || null)} className="w-36 font-mono text-xs md:text-xs" />
      </FilterField>
      <FilterField label="To" htmlFor="to">
        <Input id="to" type="date" defaultValue={current.to ?? ""} onChange={(e) => set("to", e.target.value || null)} className="w-36 font-mono text-xs md:text-xs" />
      </FilterField>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}>
          Clear
        </Button>
      )}
    </FilterBar>
  );
}
