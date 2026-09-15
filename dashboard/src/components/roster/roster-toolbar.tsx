"use client";

import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { materializeWeek } from "@/app/(app)/roster/actions";
import { dayAnchor, isInMonth, isoDate, rangeLabel, ROSTER_VIEWS, stepAnchor, type RosterView } from "@/lib/domain/roster";

const VIEW_LABEL: Record<RosterView, string> = { week: "Week", month: "Month" };

export function RosterToolbar({
  sites,
  siteId,
  anchor,
  days,
  today,
  view,
  canEdit,
}: {
  sites: { id: string; name: string }[];
  siteId: string;
  /** yyyy-MM-dd the grid is built around — not days[0], which in the month view is padding. */
  anchor: string;
  days: string[];
  today: string;
  view: RosterView;
  canEdit: boolean;
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

  const anchorDate = dayAnchor(anchor);
  const unit = view === "month" ? "month" : "week";
  const isCurrent = view === "month" ? isInMonth(today, anchorDate) : days.includes(today);
  const from = days[0]!;
  const to = days.at(-1)!;

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
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Previous ${unit}`}
          onClick={() => go({ week: isoDate(stepAnchor(anchorDate, view, -1)), day: null })}
        >
          <ChevronLeft />
        </Button>
        <Button variant={isCurrent ? "secondary" : "outline"} size="sm" onClick={() => go({ week: null, day: null })}>
          This {unit}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Next ${unit}`}
          onClick={() => go({ week: isoDate(stepAnchor(anchorDate, view, 1)), day: null })}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5" role="group" aria-label="Roster view">
        {ROSTER_VIEWS.map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "secondary" : "ghost"}
            aria-pressed={view === v}
            onClick={() => go({ view: v === "week" ? null : v, day: null })}
          >
            {VIEW_LABEL[v]}
          </Button>
        ))}
      </div>

      {canEdit && <FillFromPatterns from={from} to={to} unit={unit} />}
    </div>
  );
}

/**
 * The button that turns the standing weekly patterns into real shifts. It names the
 * range it is about to touch — the visible week or the visible month — and reports
 * back how many shifts it created, so it never fires silently.
 */
function FillFromPatterns({ from, to, unit }: { from: string; to: string; unit: string }) {
  const [state, formAction, pending] = useActionState(materializeWeek, undefined);
  const seen = useRef(state);
  const label = rangeLabel(from, to);

  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="ml-auto flex items-center gap-2">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Create the shifts this {unit}&rsquo;s patterns imply
      </span>
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        title={`Create shifts from every weekly pattern across ${label}`}
      >
        <CalendarPlus data-icon="inline-start" />
        {pending ? "Filling…" : "Fill from patterns"}
        <span className="ml-1 font-mono tabular text-[11px] opacity-80">{label}</span>
      </Button>
    </form>
  );
}
