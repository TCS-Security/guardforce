"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/gf/button-link";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Site picker + month pager for the leave calendar (URL-driven). */
export function CalendarControls({
  sites, siteId, month, prevMonth, nextMonth, monthLabel,
}: {
  sites: { id: string; name: string }[];
  siteId: string;
  month: string;
  prevMonth: string;
  nextMonth: string;
  monthLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Select
        value={siteId}
        onValueChange={(v) => {
          if (typeof v === "string" && v) router.push(`/leave/calendar?site=${v}&m=${month}`);
        }}
      >
        <SelectTrigger aria-label="Site" className="min-w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sites.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1" role="group" aria-label={`Calendar month: ${monthLabel}`}>
        <ButtonLink href={`/leave/calendar?site=${siteId}&m=${prevMonth}`} variant="outline" size="icon-sm" aria-label="Previous month">
          <ChevronLeft />
        </ButtonLink>
        <span className="font-display min-w-40 text-center text-[15px] font-semibold tracking-tight" aria-live="polite">{monthLabel}</span>
        <ButtonLink href={`/leave/calendar?site=${siteId}&m=${nextMonth}`} variant="outline" size="icon-sm" aria-label="Next month">
          <ChevronRight />
        </ButtonLink>
      </div>
    </div>
  );
}
