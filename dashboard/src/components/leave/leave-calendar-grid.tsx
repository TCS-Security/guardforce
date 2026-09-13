"use client";

import { useState } from "react";
import { format } from "date-fns";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { LeaveStatusBadge } from "@/components/gf/attendance-badge";
import { fmtLeaveRange, leaveDays, THIN_COVER_THRESHOLD } from "@/lib/domain/leave";
import { LEAVE_TYPE } from "@/lib/domain/status";
import type { CalendarDay, CalendarEntry } from "@/lib/data/leave";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayChip({ entry, pending }: { entry: CalendarEntry; pending?: boolean }) {
  return (
    <span
      title={`${entry.guardName} — ${LEAVE_TYPE[entry.type]} (${fmtLeaveRange(entry.start, entry.end)})`}
      className={
        pending
          ? "flex items-center gap-1 rounded-[4px] border border-dashed border-on-leave/60 px-1 py-0.5"
          : "flex items-center gap-1 rounded-[4px] bg-on-leave/12 px-1 py-0.5"
      }
    >
      <GuardAvatar name={entry.guardName} src={entry.avatar} size="xs" className={pending ? "opacity-50" : ""} />
      <span className={`max-w-24 truncate text-[11px] leading-tight ${pending ? "text-muted-foreground" : "text-on-leave"}`}>
        {entry.guardName.split(" ")[0]}
      </span>
    </span>
  );
}

function DetailList({ title, entries, status }: { title: string; entries: CalendarEntry[]; status: "approved" | "pending" }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h4 className="eyebrow mt-3 first:mt-0">{title}</h4>
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.leaveId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
            <div className="flex min-w-44 items-center gap-2.5">
              <GuardAvatar name={e.guardName} src={e.avatar} size="sm" />
              <span className="font-medium">{e.guardName}</span>
            </div>
            <LeaveStatusBadge status={status} size="xs" />
            <StatusPill tone="neutral" dot={false} size="xs">{LEAVE_TYPE[e.type]}</StatusPill>
            <span className="text-sm">
              {fmtLeaveRange(e.start, e.end)}
              <Mono className="ml-1.5 text-muted-foreground">{leaveDays(e.start, e.end)}d</Mono>
            </span>
            {e.reason && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={e.reason}>“{e.reason}”</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Month grid of leave at one site: approved leave as chips, pending as dashed
 * chips, thin-cover days marked with a signal dot. Clicking a day shows its list.
 */
export function LeaveCalendarGrid({ days, today }: { days: CalendarDay[]; today: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDay = days.find((d) => d.date === selected);
  const weeks = Math.ceil(days.length / 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse" aria-label="Leave calendar month grid">
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="eyebrow border-b px-1.5 py-1.5 text-left font-normal">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: weeks }, (_, w) => (
              <tr key={w}>
                {days.slice(w * 7, w * 7 + 7).map((day) => {
                  const isToday = day.date === today;
                  const isSelected = day.date === selected;
                  const label =
                    `${format(new Date(`${day.date}T00:00:00Z`), "d MMMM", { timeZone: "UTC" })}: ` +
                    `${day.approved.length} approved, ${day.pending.length} pending` +
                    (day.thinCover ? `, thin cover (${THIN_COVER_THRESHOLD}+ guards out)` : "");
                  return (
                    <td
                      key={day.date}
                      className={`border-b border-r p-0 align-top last:border-r-0 ${day.inMonth ? "" : "bg-muted/30"}`}
                    >
                      <button
                        type="button"
                        aria-label={label}
                        aria-pressed={isSelected}
                        onClick={() => setSelected(isSelected ? null : day.date)}
                        className={`relative block min-h-24 w-full px-1.5 py-1.5 text-left transition-colors ${
                          day.inMonth ? "hover:bg-muted/60" : "text-muted-foreground"
                        } ${isSelected ? "bg-muted ring-2 ring-ring ring-inset" : ""}`}
                      >
                        <span className="flex items-center justify-between">
                          <Mono className={isToday ? "font-semibold text-primary" : undefined}>{day.date.slice(8)}</Mono>
                          {day.thinCover && day.inMonth && (
                            <span className="inline-block size-2 rounded-full bg-signal" title="Thin cover — 2+ guards on approved leave" />
                          )}
                        </span>
                        <span className="mt-1 flex flex-col gap-1">
                          {day.approved.map((e) => <DayChip key={e.leaveId} entry={e} />)}
                          {day.pending.map((e) => <DayChip key={e.leaveId} entry={e} pending />)}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDay && (
        <div className="rounded-lg border bg-card p-4" data-testid="calendar-day-detail">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[15px] font-semibold tracking-tight">
              {format(new Date(`${selectedDay.date}T00:00:00Z`), "EEEE d MMMM yyyy", { timeZone: "UTC" })}
              {selectedDay.date === today && <span className="ml-2 text-xs font-normal text-muted-foreground">today</span>}
            </h3>
            <span className="text-xs text-muted-foreground">
              {selectedDay.approved.length} approved · {selectedDay.pending.length} pending
            </span>
          </div>
          {selectedDay.approved.length + selectedDay.pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No one is on leave at this site this day.</p>
          ) : (
            <>
              <DetailList title="Approved" entries={selectedDay.approved} status="approved" />
              <DetailList title="Pending" entries={selectedDay.pending} status="pending" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
