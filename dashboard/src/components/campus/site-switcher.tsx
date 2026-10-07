"use client";

import { usePathname, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CampusSiteOption } from "@/lib/data/campus";

/** Which of the user's sites the campus screens are showing. Kept in `?site=` so links carry it. */
export function SiteSwitcher({ sites, value }: { sites: CampusSiteOption[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (sites.length < 2) return null;
  return (
    <Select value={value} onValueChange={(v) => v && router.push(`${pathname}?site=${v}`)}>
      <SelectTrigger aria-label="Campus" className="h-9 max-w-[280px] gap-2 bg-card">
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue>{(v: string) => sites.find((s) => s.id === v)?.name ?? "Pick a site"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
