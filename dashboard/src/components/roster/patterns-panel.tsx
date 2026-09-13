import { CalendarRange } from "lucide-react";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { Button } from "@/components/ui/button";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { endPattern } from "@/app/(app)/roster/actions";
import { describeWeekdays } from "@/lib/domain/roster";
import { fmtDate } from "@/lib/domain/format";

type Pattern = {
  id: string;
  weekdays: number[];
  starts_on: string;
  ends_on: string | null;
  guards: { full_name: string; employee_code: string | null } | null;
  shift_types: { name: string } | null;
};

/** Weekly repeats that keep generating shifts — the thing to edit when a guard moves post. */
export function PatternsPanel({ patterns, canEdit }: { patterns: Pattern[]; canEdit: boolean }) {
  const active = patterns.filter((p) => !p.ends_on || p.ends_on >= new Date().toISOString().slice(0, 10));
  return (
    <Section
      title="Weekly patterns"
      description="Standing assignments that generate this site's shifts"
      bodyClassName="p-0"
      style={{ ["--i" as string]: 3 }}
    >
      {active.length === 0 ? (
        <EmptyState
          icon={<CalendarRange />}
          title="No standing patterns"
          description="Tick “repeat weekly” when assigning a guard to create one."
          className="border-0"
        />
      ) : (
        <ul className="divide-y">
          {active.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <GuardAvatar name={p.guards?.full_name ?? "Guard"} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.guards?.full_name ?? "Guard"}</div>
                <Mono className="text-muted-foreground">
                  {p.shift_types?.name ?? "Shift"} · {describeWeekdays(p.weekdays)} · from {fmtDate(p.starts_on, undefined, "d MMM")}
                  {p.ends_on ? ` to ${fmtDate(p.ends_on, undefined, "d MMM")}` : ""}
                </Mono>
              </div>
              {canEdit && (
                <form action={endPattern}>
                  <input type="hidden" name="pattern_id" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm">End today</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
