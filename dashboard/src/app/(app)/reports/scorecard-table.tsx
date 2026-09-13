"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/gf/empty-state";
import { fmtMinutes, fmtPct } from "@/lib/domain/format";
import { sortScorecards, type GuardScorecardRow, type ScorecardSortKey } from "@/lib/domain/reports";

const COLUMNS: { key: ScorecardSortKey; label: string; align?: "right" }[] = [
  { key: "guard_name", label: "Guard" },
  { key: "site_name", label: "Site" },
  { key: "shifts", label: "Shifts", align: "right" },
  { key: "punctuality_pct", label: "Punctuality", align: "right" },
  { key: "present", label: "Present", align: "right" },
  { key: "half_day", label: "Half day", align: "right" },
  { key: "absent", label: "Absent", align: "right" },
  { key: "avg_away_min", label: "Avg away", align: "right" },
  { key: "missed_patrols", label: "Missed patrols", align: "right" },
  { key: "flagged", label: "Flags", align: "right" },
  { key: "void", label: "Void", align: "right" },
];

/** Sortable guard scorecard table for the filtered range. Sorting is client-side — the rows are already fetched once. */
export function ScorecardTable({ rows }: { rows: GuardScorecardRow[] }) {
  const [sort, setSort] = useState<{ key: ScorecardSortKey; dir: "asc" | "desc" }>({ key: "guard_name", dir: "asc" });
  const sorted = useMemo(() => sortScorecards(rows, sort.key, sort.dir), [rows, sort]);

  if (rows.length === 0) {
    return <EmptyState title="No shifts in this range" description="Widen the date range or clear the site/guard filters." />;
  }

  function toggle(key: ScorecardSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Guard scorecards">
        <thead>
          <tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
            {COLUMNS.map((c) => (
              <th key={c.key} className={c.align === "right" ? "text-right" : ""}>
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                  aria-label={`Sort by ${c.label}`}
                >
                  {c.label}
                  {sort.key === c.key ? (
                    sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((r) => (
            <tr key={r.guard_id} className="transition-colors hover:bg-muted/50">
              <td className="px-3 py-2">
                <Link href={`/guards/${r.guard_id}`} className="font-medium hover:underline">{r.guard_name}</Link>
                {r.employee_code && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{r.employee_code}</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.site_name}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{r.shifts}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{fmtPct(r.punctuality_pct)}</td>
              <td className="px-3 py-2 text-right font-mono tabular text-present">{r.present}</td>
              <td className="px-3 py-2 text-right font-mono tabular text-half-day-foreground dark:text-half-day">{r.half_day}</td>
              <td className="px-3 py-2 text-right font-mono tabular text-absent">{r.absent}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{fmtMinutes(r.avg_away_min)}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{r.missed_patrols}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{r.flagged}</td>
              <td className="px-3 py-2 text-right font-mono tabular">{r.void}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
