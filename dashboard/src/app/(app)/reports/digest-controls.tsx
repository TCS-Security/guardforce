"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryParams } from "@/components/gf/use-query-params";

/** Date picker for the digest preview — independent of the analytics filter bar's range. */
export function DigestControls({ date }: { date: string }) {
  const { set } = useQueryParams();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="digest-date" className="eyebrow">Date</Label>
      <Input
        id="digest-date"
        type="date"
        value={date}
        onChange={(e) => set({ digestDate: e.target.value })}
        className="h-7 w-[150px] text-xs"
      />
    </div>
  );
}
