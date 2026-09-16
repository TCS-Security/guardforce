"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { StatusPill } from "@/components/gf/status-pill";
import { FormAlert } from "@/components/gf/form-alert";
import { assignShift, type ActionState } from "@/app/(app)/roster/actions";
import { KYC_GAP_LABELS } from "@/lib/domain/kyc";
import { WEEKDAY_LABELS, weekdayOf } from "@/lib/domain/roster";
import { shiftWindowLabel } from "@/lib/domain/sites";
import type { ShiftType } from "@/lib/supabase/types";
import type { AssignableGuard } from "./roster-board";
import { cn } from "cn";

export function AssignDialog({
  siteId,
  guards,
  shiftType,
  day,
  timezone,
  onClose,
}: {
  siteId: string;
  guards: AssignableGuard[];
  shiftType: ShiftType | null;
  day: string | null;
  timezone: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [guardId, setGuardId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await assignShift(prev, fd);
    if (res?.ok) {
      setGuardId(null);
      setRepeat(false);
      onClose();
    }
    return res;
  }, undefined);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const rows = guards.filter((g) => !q || [g.full_name, g.employee_code, g.designation].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
    // Guards posted at this site first, then everyone else, alphabetically.
    return rows.sort((a, b) => {
      const home = Number(b.is_home_site) - Number(a.is_home_site);
      if (home !== 0) return home;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [guards, query]);

  const selected = guards.find((g) => g.id === guardId) ?? null;
  const dayIndex = day ? weekdayOf(day) : null;

  return (
    <Dialog
      open={!!shiftType && !!day}
      onOpenChange={(v) => {
        if (!v) onClose();
        else if (dayIndex != null) setWeekdays([dayIndex]);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign to {shiftType?.name}</DialogTitle>
          <DialogDescription>
            {day} · {shiftType ? shiftWindowLabel(shiftType) : ""} ({timezone.split("/")[1]?.replace("_", " ")})
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="shift_type_id" value={shiftType?.id ?? ""} />
          <input type="hidden" name="shift_date" value={day ?? ""} />
          <input type="hidden" name="guard_id" value={guardId ?? ""} />
          <input type="hidden" name="repeat" value={repeat ? "weekly" : "once"} />
          <input type="hidden" name="weekdays" value={weekdays.join(",")} />

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guards" aria-label="Search guards" className="h-8 pl-8" />
          </div>

          <div role="radiogroup" aria-label="Guard" className="max-h-[260px] overflow-y-auto rounded-md border">
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No guards match.</p>}
            {filtered.map((g) => {
              // KYC gaps are shown, not enforced: rostering a guard whose paperwork is
              // still being chased is normal, so this is a nudge rather than a gate.
              const incomplete = g.kyc_gaps.length > 0;
              const active = g.id === guardId;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setGuardId(g.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60",
                    active && "bg-primary/10",
                  )}
                >
                  <GuardAvatar name={g.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.full_name}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {g.employee_code}{g.designation ? ` · ${g.designation}` : ""}{g.is_home_site ? "" : " · other site"}
                    </div>
                  </div>
                  {incomplete && (
                    <StatusPill tone="half-day" size="xs" className="shrink-0">
                      <ShieldAlert className="size-3" /> KYC
                    </StatusPill>
                  )}
                </button>
              );
            })}
          </div>

          {selected && selected.kyc_gaps.length > 0 && (
            <FormAlert tone="warning">
              {selected.full_name} can be rostered. KYC still incomplete: {selected.kyc_gaps.map((g) => KYC_GAP_LABELS[g]).join("; ")}.
            </FormAlert>
          )}

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="repeat-weekly" checked={repeat} onCheckedChange={(v) => setRepeat(!!v)} />
              <Label htmlFor="repeat-weekly" className="text-sm font-normal">Repeat weekly</Label>
            </div>
            {repeat && (
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <Label className="eyebrow mb-1.5">Days</Label>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={weekdays.includes(idx)}
                        onClick={() => setWeekdays((w) => (w.includes(idx) ? w.filter((d) => d !== idx) : [...w, idx]))}
                        className={cn(
                          "h-7 w-11 rounded-md border text-xs transition-colors",
                          weekdays.includes(idx) ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex max-w-[200px] flex-col gap-1.5">
                  <Label htmlFor="ends_on">Until (optional)</Label>
                  <Input id="ends_on" name="ends_on" type="date" min={day ?? undefined} className="h-8" />
                </div>
                <p className="text-xs text-muted-foreground">Shifts for the next two weeks are created straight away; the rest follow automatically.</p>
              </div>
            )}
          </div>

          {state?.error && <FormAlert>{state.error}</FormAlert>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || !guardId}>
              {pending && <Loader2 className="animate-spin" />}
              {repeat ? "Create pattern" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
