"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

  function shiftDate(days: number) {
    const d = new Date(`${current.date}T12:00:00`);
    d.setDate(d.getDate() + days);
    set("date", d.toISOString().slice(0, 10));
  }

  return (
    <div className="reveal flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="att-date" className="eyebrow">Date</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous day" onClick={() => shiftDate(-1)}>‹</Button>
          <Input id="att-date" type="date" value={current.date} onChange={(e) => set("date", e.target.value)} className="h-7 w-[140px]" />
          <Button variant="outline" size="icon-sm" aria-label="Next day" onClick={() => shiftDate(1)}>›</Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="eyebrow">Site</Label>
        <Select value={current.siteId ?? "all"} onValueChange={(v) => set("site", v as string)}>
          <SelectTrigger size="sm" className="w-[200px]" aria-label="Site">
            <SelectValue>{(v: string) => (!v || v === "all" ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="eyebrow">Attendance</Label>
        <Select value={normalizeStatusFilter(current.status)} onValueChange={(v) => set("status", v as string)}>
          <SelectTrigger size="sm" className="w-[170px]" aria-label="Attendance status">
            <SelectValue>{(v: string) => STATUSES.find((s) => s.value === (v || "all"))?.label ?? "Any status"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="eyebrow">Trust</Label>
        <Select value={normalizeTrustFilter(current.trust)} onValueChange={(v) => set("trust", v as string)}>
          <SelectTrigger size="sm" className="w-[170px]" aria-label="Trust level">
            <SelectValue>{(v: string) => TRUST.find((s) => s.value === (v || "all"))?.label ?? "Any trust"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TRUST.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={current.q ?? ""}
          onChange={(e) => set("q", e.target.value || null)}
          placeholder="Search guard or code"
          aria-label="Search guards"
          className="h-7 pl-8"
        />
      </div>
    </div>
  );
}
