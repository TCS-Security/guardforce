"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { StatusPill } from "@/components/gf/status-pill";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ATTENDANCE, SHIFT_STATUS } from "@/lib/domain/status";
import { cellCoverage, weekdayOf, WEEKDAY_LABELS, canUnassign } from "@/lib/domain/roster";
import { shiftWindowLabel } from "@/lib/domain/sites";
import type { RosterShift } from "@/lib/data/roster";
import type { ShiftType } from "@/lib/supabase/types";
import type { KycGap } from "@/lib/domain/kyc";
import { AssignDialog } from "./assign-dialog";
import { cn } from "cn";

export type AssignableGuard = {
  id: string;
  full_name: string;
  employee_code: string | null;
  designation: string | null;
  is_home_site: boolean;
  status: string;
  kyc_gaps: KycGap[];
};

/** Week grid: shift types down the side, days across the top, guards in the cells. */
export function RosterBoard({
  siteId,
  siteName,
  days,
  today,
  focusDay = null,
  shiftTypes,
  shifts,
  guards,
  canEdit,
  timezone,
}: {
  siteId: string;
  siteName: string;
  days: string[];
  today: string;
  /** Day arrived at from the month grid: highlighted and scrolled into view. */
  focusDay?: string | null;
  shiftTypes: ShiftType[];
  shifts: RosterShift[];
  guards: AssignableGuard[];
  canEdit: boolean;
  timezone: string;
}) {
  const [assigning, setAssigning] = useState<{ shiftType: ShiftType; day: string } | null>(null);
  const focusRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (focusDay) focusRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [focusDay]);

  const byCell = useMemo(() => {
    const map = new Map<string, RosterShift[]>();
    for (const s of shifts) {
      const key = `${s.shift_type_id}|${s.shift_date}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [shifts]);

  return (
    <>
      <div className="reveal overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[840px] border-separate border-spacing-0" aria-label={`Roster week for ${siteName}`}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-[132px] border-b bg-card px-3 py-2 text-left">
                <span className="eyebrow">Shift</span>
              </th>
              {days.map((d) => {
                const isToday = d === today;
                const isFocused = d === focusDay;
                return (
                  <th
                    key={d}
                    scope="col"
                    ref={isFocused ? focusRef : undefined}
                    className={cn(
                      "border-b border-l px-3 py-2 text-left",
                      isToday && "bg-primary/5",
                      isFocused && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                    )}
                  >
                    <div className="eyebrow">{WEEKDAY_LABELS[weekdayOf(d)]}</div>
                    <div className={cn("font-mono tabular text-xs", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>
                      {d.slice(8)}/{d.slice(5, 7)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shiftTypes.map((st) => (
              <tr key={st.id} className="align-top">
                <th scope="row" className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left">
                  <div className="text-sm font-medium">{st.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{shiftWindowLabel(st)}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">needs {st.guards_required}</div>
                </th>
                {days.map((d) => {
                  const cell = byCell.get(`${st.id}|${d}`) ?? [];
                  const cover = cellCoverage(cell, st.guards_required);
                  const isToday = d === today;
                  const isPast = d < today;
                  const isFocused = d === focusDay;
                  return (
                    <td
                      key={d}
                      className={cn(
                        "min-w-[118px] border-b border-l px-1.5 py-2",
                        isToday && "bg-primary/5",
                        isPast && "bg-muted/20",
                        isFocused && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        {cell.map((s) => (
                          <GuardChip key={s.id} shift={s} canEdit={canEdit} />
                        ))}
                        {cover.short > 0 && (
                          <div className="flex items-center gap-1">
                            {canEdit ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label={`Fill ${st.name} on ${d}`}
                                className="w-full justify-start border border-dashed border-signal/40 text-signal hover:bg-signal/10"
                                onClick={() => setAssigning({ shiftType: st, day: d })}
                              >
                                <Plus data-icon="inline-start" /> {`${cover.short} to fill`}
                              </Button>
                            ) : (
                              <StatusPill tone="signal" size="xs">{cover.short} short</StatusPill>
                            )}
                          </div>
                        )}
                        {cover.short === 0 && canEdit && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="w-full justify-start text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => setAssigning({ shiftType: st, day: d })}
                            aria-label={`Add to ${st.name} on ${d}`}
                          >
                            <Plus data-icon="inline-start" /> Add
                          </Button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignDialog
        siteId={siteId}
        guards={guards}
        shiftType={assigning?.shiftType ?? null}
        day={assigning?.day ?? null}
        timezone={timezone}
        onClose={() => setAssigning(null)}
      />
    </>
  );
}

function GuardChip({ shift, canEdit }: { shift: RosterShift; canEdit: boolean }) {
  const guard = shift.guards;
  const attendance = ATTENDANCE[shift.attendance as keyof typeof ATTENDANCE];
  const status = SHIFT_STATUS[shift.status as keyof typeof SHIFT_STATUS];
  const removable = canEdit && canUnassign(shift);
  const tone = shift.status === "in_progress" ? "present" : shift.status === "scheduled" ? "neutral" : attendance.tone;

  return (
    <div className="group/chip flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1">
      <GuardAvatar name={guard?.full_name ?? "Guard"} size="xs" />
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <a href={`/attendance/${shift.id}`} className="min-w-0 flex-1 truncate text-xs hover:underline">
            {guard?.full_name?.split(" ")[0] ?? "Guard"}
          </a>
        </TooltipTrigger>
        <TooltipContent>
          {guard?.full_name} · {shift.status === "scheduled" ? status.label : attendance.label}
        </TooltipContent>
      </Tooltip>
      {shift.status !== "scheduled" && (
        <StatusPill tone={tone} size="xs" dot={false} className="shrink-0 px-1">
          {shift.status === "in_progress" ? "on" : attendance.short}
        </StatusPill>
      )}
      {removable && <UnassignButton shiftId={shift.id} name={guard?.full_name ?? "guard"} />}
    </div>
  );
}

function UnassignButton({ shiftId, name }: { shiftId: string; name: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`Remove ${name} from this shift`}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { unassignShift } = await import("@/app/(app)/roster/actions");
        const fd = new FormData();
        fd.set("shift_id", shiftId);
        const res = await unassignShift(undefined, fd);
        if (res?.error) {
          const { toast } = await import("sonner");
          toast.error(res.error);
        } else {
          router.refresh();
        }
        setPending(false);
      }}
      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/chip:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
    >
      <X className="size-3" />
    </button>
  );
}
