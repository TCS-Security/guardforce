"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Site = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const KYC_OPTIONS = [
  { value: "all", label: "KYC: any" },
  { value: "complete", label: "KYC complete" },
  { value: "incomplete", label: "KYC incomplete" },
];

/** Roster filters: pushes site/status/kyc/search into the URL so the list stays a Server Component. */
export function GuardFilters({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  // Debounce the search box so we don't push a route change per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) setParam("q", q);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, code…"
          aria-label="Search guards"
          className="h-8 w-56 pl-8"
        />
      </div>
      <Select value={searchParams.get("site") ?? "all"} onValueChange={(v) => setParam("site", v ?? "all")}>
        <SelectTrigger aria-label="Filter by site" size="sm">
          <SelectValue>{(v: string) => (v === "all" || !v ? "All sites" : (sites.find((s) => s.id === v)?.name ?? "All sites"))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sites</SelectItem>
          {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => setParam("status", v ?? "all")}>
        <SelectTrigger aria-label="Filter by status" size="sm">
          <SelectValue>{(v: string) => STATUS_OPTIONS.find((o) => o.value === v)?.label ?? "All statuses"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("kyc") ?? "all"} onValueChange={(v) => setParam("kyc", v ?? "all")}>
        <SelectTrigger aria-label="Filter by KYC completeness" size="sm">
          <SelectValue>{(v: string) => KYC_OPTIONS.find((o) => o.value === v)?.label ?? "KYC: any"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {KYC_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
