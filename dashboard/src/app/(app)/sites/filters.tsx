"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
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
    <div className="reveal flex flex-wrap items-center gap-4">
      <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={q}
          onChange={(e) => update("q", e.target.value || null)}
          placeholder="Search site, client or area"
          aria-label="Search sites"
          className="h-8 pl-8"
        />
      </div>
      {inactiveCount > 0 && (
        <div className="flex items-center gap-2">
          <Switch id="inactive" checked={showInactive} onCheckedChange={(v) => update("inactive", v ? "1" : null)} />
          <Label htmlFor="inactive" className="text-xs text-muted-foreground">Show {inactiveCount} inactive</Label>
        </div>
      )}
    </div>
  );
}
