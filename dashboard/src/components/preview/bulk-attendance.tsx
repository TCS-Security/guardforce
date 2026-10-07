"use client";

import { useState } from "react";
import { Camera, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardCell } from "./guard-cell";
import { ATTENDANCE } from "@/lib/domain/status";
import type { CrewGuard, CrewSite } from "@/lib/preview/crew";
import { cn } from "cn";

type Mark = "present" | "half_day" | "absent" | "on_leave";
const MARKS: Mark[] = ["present", "half_day", "absent", "on_leave"];

const ACTIVE: Record<Mark, string> = {
  present: "aria-pressed:bg-present aria-pressed:text-present-foreground",
  half_day: "aria-pressed:bg-half-day aria-pressed:text-foreground",
  absent: "aria-pressed:bg-absent aria-pressed:text-white",
  on_leave: "aria-pressed:bg-on-leave aria-pressed:text-white",
};

export function BulkAttendance({ sites, guards, today }: { sites: CrewSite[]; guards: CrewGuard[]; today: string }) {
  const [siteId, setSiteId] = useState(sites[0]!.id);
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState("day");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const atSite = guards.filter((g) => g.site_id === siteId);
  const done = atSite.filter((g) => marks[g.id]).length;
  const counts = MARKS.map((m) => ({ m, n: atSite.filter((g) => marks[g.id] === m).length }));

  function setAll(m: Mark) {
    setMarks((x) => ({ ...x, ...Object.fromEntries(atSite.map((g) => [g.id, m])) }));
  }

  function save() {
    if (done < atSite.length) return toast.error(`${atSite.length - done} guard${atSite.length - done === 1 ? "" : "s"} still unmarked`);
    toast.success(`Attendance saved for ${atSite.length} guards`, { description: "Preview only — not saved." });
    setMarks({});
    setPhoto(null);
  }

  return (
    <>
      <Section style={{ ["--i" as string]: 1 }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bm-site">Site</Label>
            <Select value={siteId} onValueChange={(v) => { if (v) { setSiteId(v); setMarks({}); } }}>
              <SelectTrigger id="bm-site" className="w-full" aria-label="Site"><SelectValue>{sites.find((s) => s.id === siteId)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bm-date">Date</Label>
            <Input id="bm-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Shift</Label>
            <ToggleGroup value={[shift]} onValueChange={(v) => v[0] && setShift(v[0])} variant="outline" aria-label="Shift">
              <ToggleGroupItem value="day">Day</ToggleGroupItem>
              <ToggleGroupItem value="night">Night</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </Section>

      <Section
        title={`${atSite.length} guard${atSite.length === 1 ? "" : "s"} posted here`}
        description={<Mono className="text-xs">{done}/{atSite.length} marked</Mono>}
        actions={atSite.length > 0 && <Button size="sm" variant="outline" onClick={() => setAll("present")}><CheckCheck data-icon="inline-start" /> Everyone present</Button>}
        bodyClassName="p-0"
        style={{ ["--i" as string]: 2 }}
      >
        {atSite.length === 0 ? (
          <EmptyState title="Nobody is posted here" description="Assign guards to this site from the roster first." className="m-4" />
        ) : (
          <ul className="divide-y" aria-label="Guards to mark">
            {atSite.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <GuardCell guard={g} />
                <ToggleGroup
                  value={marks[g.id] ? [marks[g.id]!] : []}
                  onValueChange={(v) => setMarks((x) => ({ ...x, [g.id]: v[0] as Mark }))}
                  variant="outline"
                  size="sm"
                  aria-label={`Attendance for ${g.full_name}`}
                >
                  {MARKS.map((m) => (
                    <ToggleGroupItem key={m} value={m} aria-label={ATTENDANCE[m].label} className={cn("min-w-9 font-mono", ACTIVE[m])} title={ATTENDANCE[m].label}>
                      {ATTENDANCE[m].short}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="reveal sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 px-4 py-3 shadow-lg backdrop-blur" style={{ ["--i" as string]: 3 }}>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {counts.map(({ m, n }) => (
            <span key={m} className="flex items-center gap-1.5"><Mono>{n}</Mono> <span className="text-muted-foreground">{ATTENDANCE[m].label.toLowerCase()}</span></span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<label />} className="cursor-pointer">
            <Camera data-icon="inline-start" /> {photo ? "Photo added" : "Group photo"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)} />
          </Button>
          <Button onClick={save} disabled={atSite.length === 0}>Save attendance</Button>
        </div>
      </div>
    </>
  );
}
