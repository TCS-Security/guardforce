"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { FilterBar, FilterField, FilterSearch } from "@/components/gf/filter-bar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/** URL-synced search + inactive toggle for the sites list. */
export function SitesFilters({ q, showInactive, inactiveCount }: { q: string; showInactive: boolean; inactiveCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <FilterBar className="items-end" aria-label="Filter sites">
      <FilterField label="Search" htmlFor="site-search" className="min-w-[240px] flex-1 sm:max-w-xs">
        <FilterSearch
          id="site-search"
          defaultValue={q}
          onChange={(e) => update("q", e.target.value || null)}
          placeholder="Search site, client or area"
          aria-label="Search sites"
        />
      </FilterField>
      {inactiveCount > 0 && (
        <div className="flex h-8 items-center gap-2">
          <Switch id="inactive" checked={showInactive} onCheckedChange={(v) => update("inactive", v ? "1" : null)} />
          <Label htmlFor="inactive" className="text-xs text-muted-foreground">Show {inactiveCount} inactive</Label>
        </div>
      )}
    </FilterBar>
  );
}
