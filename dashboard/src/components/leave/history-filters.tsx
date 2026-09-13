"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LEAVE_STATUS, LEAVE_TYPE } from "@/lib/domain/status";
import type { GuardOption } from "@/lib/data/leave";
import type { HistoryFilters } from "@/lib/data/leave";

/** GET-form filters for the leave history tab (page reload keeps the tab). */
export function HistoryFiltersForm({
  filters, sites, guards,
}: {
  filters: HistoryFilters;
  sites: { id: string; name: string }[];
  guards: GuardOption[];
}) {
  return (
    <form method="get" action="/leave" className="flex flex-wrap items-end gap-3" aria-label="Filter history">
      <input type="hidden" name="tab" value="history" />
      <Field className="w-36">
        <Label htmlFor="f-status">Status</Label>
        <Select name="status" defaultValue={filters.status}>
          <SelectTrigger id="f-status" className="w-full" aria-label="Status">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All statuses" : (LEAVE_STATUS[v as keyof typeof LEAVE_STATUS]?.label ?? "All statuses"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(LEAVE_STATUS) as (keyof typeof LEAVE_STATUS)[]).map((s) => (
              <SelectItem key={s} value={s}>{LEAVE_STATUS[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-36">
        <Label htmlFor="f-type">Type</Label>
        <Select name="type" defaultValue={filters.type}>
          <SelectTrigger id="f-type" className="w-full" aria-label="Type">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All types" : (LEAVE_TYPE[v as keyof typeof LEAVE_TYPE] ?? "All types"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(LEAVE_TYPE) as (keyof typeof LEAVE_TYPE)[]).map((t) => (
              <SelectItem key={t} value={t}>{LEAVE_TYPE[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-52">
        <Label htmlFor="f-site">Site</Label>
        <Select name="siteId" defaultValue={filters.siteId}>
          <SelectTrigger id="f-site" className="w-full" aria-label="Site">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-56">
        <Label htmlFor="f-guard">Guard</Label>
        <Select name="guardId" defaultValue={filters.guardId}>
          <SelectTrigger id="f-guard" className="w-full" aria-label="Guard">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All guards" : (guards.find((g) => g.id === v)?.label ?? "All guards"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All guards</SelectItem>
            {guards.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-40">
        <Label htmlFor="f-from">From</Label>
        <Input id="f-from" name="from" type="date" defaultValue={filters.from ?? ""} />
      </Field>
      <Field className="w-40">
        <Label htmlFor="f-to">To</Label>
        <Input id="f-to" name="to" type="date" defaultValue={filters.to ?? ""} />
      </Field>
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm">Apply</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { window.location.href = "/leave?tab=history"; }}>
          Reset
        </Button>
      </div>
    </form>
  );
}
