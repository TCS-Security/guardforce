import Link from "next/link";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { cellCoverage, isInMonth, MONDAY_FIRST_LABELS } from "@/lib/domain/roster";
import { shiftWindowLabel } from "@/lib/domain/sites";
import { fmtDate } from "@/lib/domain/format";
import type { RosterShift } from "@/lib/data/roster";
import type { ShiftType } from "@/lib/supabase/types";
import { cn } from "cn";

/** First names of the guards in a cell, kept to one line. */
function names(shifts: RosterShift[]) {
  const first = shifts.map((s) => s.guards?.full_name?.split(" ")[0] ?? "Guard");
  if (first.length <= 2) return first.join(", ");
  return `${first.slice(0, 2).join(", ")} +${first.length - 2}`;
}

/**
 * A month of roster at one site, as a Monday-first calendar. Deliberately read-only:
 * each day links through to the week board that contains it, which is where the
 * assign/unassign interactions already live — a month grid with 30 editable cells
 * would be a second editor to keep in step with the first.
 */
export function RosterMonthBoard({
  siteId,
  siteName,
  anchor,
  days,
  today,
  shiftTypes,
  shifts,
}: {
  siteId: string;
  siteName: string;
  anchor: Date;
  days: string[];
  today: string;
  shiftTypes: ShiftType[];
  shifts: RosterShift[];
}) {
  const byCell = new Map<string, RosterShift[]>();
  for (const s of shifts) {
    const key = `${s.shift_type_id}|${s.shift_date}`;
    byCell.set(key, [...(byCell.get(key) ?? []), s]);
  }
  const weeks = Math.ceil(days.length / 7);

  return (
    <div className="reveal overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[840px] border-collapse" aria-label={`Roster month for ${siteName}`}>
        <thead>
          <tr>
            {MONDAY_FIRST_LABELS.map((w) => (
              <th key={w} scope="col" className="eyebrow border-b px-2 py-1.5 text-left font-normal">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, w) => (
            <tr key={w}>
              {days.slice(w * 7, w * 7 + 7).map((d) => {
                const inMonth = isInMonth(d, anchor);
                const isToday = d === today;
                const cells = shiftTypes.map((st) => ({
                  shiftType: st,
                  shifts: byCell.get(`${st.id}|${d}`) ?? [],
                  cover: cellCoverage(byCell.get(`${st.id}|${d}`) ?? [], st.guards_required),
                }));
                const short = cells.reduce((n, c) => n + c.cover.short, 0);
                const filled = cells.reduce((n, c) => n + c.cover.filled, 0);
                const summary = cells.length
                  ? cells.map((c) => `${c.shiftType.name} ${c.cover.filled} of ${c.cover.required}`).join(", ")
                  : "no shifts defined";

                return (
                  <td
                    key={d}
                    data-date={d}
                    className={cn(
                      "w-[14.28%] border-b border-r p-0 align-top last:border-r-0",
                      !inMonth && "bg-muted/30",
                      isToday && "bg-primary/5",
                    )}
                  >
                    <Link
                      href={`/roster?site=${siteId}&week=${d}&day=${d}`}
                      aria-label={`${fmtDate(`${d}T00:00:00Z`, "UTC", "EEEE d MMMM")}: ${summary} — open this week`}
                      className={cn(
                        "block min-h-26 px-1.5 py-1.5 transition-colors hover:bg-muted/60",
                        !inMonth && "opacity-60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <Mono
                          className={cn(
                            "text-xs",
                            isToday ? "font-semibold text-primary" : !inMonth && "text-muted-foreground",
                          )}
                        >
                          {d.slice(8)}
                        </Mono>
                        {isToday && <span className="eyebrow text-primary">today</span>}
                        {!isToday && short > 0 && inMonth && (
                          <StatusPill tone="signal" size="xs" dot={false} className="px-1">
                            {short} short
                          </StatusPill>
                        )}
                        {!isToday && short === 0 && filled > 0 && (
                          <span className="size-1.5 rounded-full bg-present" title="Fully staffed" />
                        )}
                      </span>

                      <span className="mt-1 flex flex-col gap-1">
                        {cells.map(({ shiftType, shifts: cellShifts, cover }) => (
                          <span key={shiftType.id} className="flex flex-col rounded-[4px] bg-muted/50 px-1 py-0.5">
                            <span className="flex items-baseline gap-1">
                              <span className="truncate text-[11px] leading-tight font-medium" title={shiftWindowLabel(shiftType)}>
                                {shiftType.name}
                              </span>
                              <Mono
                                className={cn(
                                  "ml-auto text-[11px]",
                                  cover.short > 0 ? "text-signal" : "text-muted-foreground",
                                )}
                              >
                                {cover.filled}/{cover.required}
                              </Mono>
                            </span>
                            {cellShifts.length > 0 && (
                              <span className="truncate text-[11px] leading-tight text-muted-foreground">
                                {names(cellShifts)}
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
