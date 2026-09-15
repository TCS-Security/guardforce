"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/gf/empty-state";
import { DataTable, type DataTableColumn } from "@/components/gf/data-table";
import { fmtMinutes, fmtPct } from "@/lib/domain/format";
import { sortScorecards, type GuardScorecardRow, type ScorecardSortKey } from "@/lib/domain/reports";

type Spec = {
  /** Omitted for columns that carry no sortable value of their own (the employee code). */
  key?: ScorecardSortKey;
  label: string;
  align?: "right";
  pin?: boolean;
  width?: number;
  cell: (r: GuardScorecardRow) => React.ReactNode;
  className?: string;
};

const SPECS: Spec[] = [
  {
    key: "guard_name",
    label: "Guard",
    pin: true,
    width: 190,
    cell: (r) => (
      <Link href={`/guards/${r.guard_id}`} className="font-medium hover:underline">
        {r.guard_name}
      </Link>
    ),
  },
  {
    label: "Code",
    pin: true,
    width: 96,
    className: "font-mono text-[11px] text-muted-foreground",
    cell: (r) => r.employee_code ?? "—",
  },
  { key: "site_name", label: "Site", width: 180, className: "text-muted-foreground", cell: (r) => r.site_name },
  { key: "shifts", label: "Shifts", align: "right", cell: (r) => r.shifts },
  { key: "punctuality_pct", label: "Punctuality", align: "right", cell: (r) => fmtPct(r.punctuality_pct) },
  { key: "present", label: "Present", align: "right", className: "text-present", cell: (r) => r.present },
  { key: "half_day", label: "Half day", align: "right", className: "text-half-day-foreground dark:text-half-day", cell: (r) => r.half_day },
  { key: "absent", label: "Absent", align: "right", className: "text-absent", cell: (r) => r.absent },
  { key: "avg_away_min", label: "Avg away", align: "right", cell: (r) => fmtMinutes(r.avg_away_min) },
  { key: "missed_patrols", label: "Missed patrols", align: "right", cell: (r) => r.missed_patrols },
  { key: "flagged", label: "Flags", align: "right", cell: (r) => r.flagged },
  { key: "void", label: "Void", align: "right", cell: (r) => r.void },
];

/** Sortable guard scorecard table for the filtered range. Sorting is client-side — the rows are already fetched once. */
export function ScorecardTable({ rows }: { rows: GuardScorecardRow[] }) {
  const [sort, setSort] = useState<{ key: ScorecardSortKey; dir: "asc" | "desc" }>({ key: "guard_name", dir: "asc" });
  const sorted = useMemo(() => sortScorecards(rows, sort.key, sort.dir), [rows, sort]);

  const columns: DataTableColumn<GuardScorecardRow>[] = SPECS.map((spec) => {
    const sortKey = spec.key;
    return {
      key: spec.label,
      align: spec.align,
      pin: spec.pin,
      width: spec.width,
      className: cn(spec.align === "right" && "font-mono tabular", spec.className),
      header: sortKey ? (
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === sortKey ? { key: sortKey, dir: s.dir === "asc" ? "desc" : "asc" } : { key: sortKey, dir: "asc" }))}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", spec.align === "right" && "flex-row-reverse")}
          aria-label={`Sort by ${spec.label}`}
        >
          {spec.label}
          {sort.key === sortKey ? (
            sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
          ) : (
            <ArrowUpDown className="size-3 opacity-30" />
          )}
        </button>
      ) : (
        spec.label
      ),
      cell: spec.cell,
    };
  });

  if (rows.length === 0) {
    return <EmptyState title="No shifts in this range" description="Widen the date range or clear the site/guard filters." />;
  }

  return <DataTable columns={columns} rows={sorted} rowKey={(r) => r.guard_id} ariaLabel="Guard scorecards" />;
}
