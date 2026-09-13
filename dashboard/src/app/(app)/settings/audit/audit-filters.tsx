"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="reveal flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entity" className="eyebrow">Entity</Label>
        <Select value={current.entityType ?? "all"} onValueChange={(v) => set("entity", v as string)}>
          <SelectTrigger id="entity" size="sm" className="w-40">
            <SelectValue>{(v) => (v === "all" ? "All entities" : String(v))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actor" className="eyebrow">Actor</Label>
        <Select value={current.actorId ?? "all"} onValueChange={(v) => set("actor", v as string)}>
          <SelectTrigger id="actor" size="sm" className="w-48">
            <SelectValue>{(v) => (v === "all" ? "Anyone" : actors.find((a) => a.id === v)?.full_name ?? "Anyone")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from" className="eyebrow">From</Label>
        <Input id="from" type="date" defaultValue={current.from ?? ""} onChange={(e) => set("from", e.target.value || null)} className="h-7 w-36" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to" className="eyebrow">To</Label>
        <Input id="to" type="date" defaultValue={current.to ?? ""} onChange={(e) => set("to", e.target.value || null)} className="h-7 w-36" />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}>
          Clear
        </Button>
      )}
    </div>
  );
}
