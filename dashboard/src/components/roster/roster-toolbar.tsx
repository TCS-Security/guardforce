"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { materializeWeek } from "@/app/(app)/roster/actions";
import { isoDate, shiftWeek } from "@/lib/domain/roster";

export function RosterToolbar({
  sites,
  siteId,
  days,
  today,
}: {
  sites: { id: string; name: string }[];
  siteId: string;
  days: string[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function go(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  const anchor = new Date(`${days[0]}T12:00:00`);
  const isThisWeek = days.includes(today);

  return (
    <div className="reveal flex flex-wrap items-center gap-2">
      <Select value={siteId} onValueChange={(v) => go({ site: v as string })}>
        <SelectTrigger className="w-[260px]" aria-label="Site">
          <SelectValue>{(v: string) => sites.find((s) => s.id === v)?.name ?? "Pick a site"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="Previous week" onClick={() => go({ week: isoDate(shiftWeek(anchor, -1)) })}>
          <ChevronLeft />
        </Button>
        <Button variant={isThisWeek ? "secondary" : "outline"} size="sm" onClick={() => go({ week: null })}>
          This week
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next week" onClick={() => go({ week: isoDate(shiftWeek(anchor, 1)) })}>
          <ChevronRight />
        </Button>
      </div>

      <form action={materializeWeek} className="ml-auto">
        <input type="hidden" name="from" value={days[0]} />
        <input type="hidden" name="to" value={days[6]} />
        <Button type="submit" variant="ghost" size="sm" title="Create shifts from the site's weekly patterns for this week">
          <RefreshCw data-icon="inline-start" /> Fill from patterns
        </Button>
      </form>
    </div>
  );
}
