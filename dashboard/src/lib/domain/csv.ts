import type { XlsxCell } from "./xlsx";

/**
 * One column of a report, shared by three renderers: the CSV writer below, the
 * .xlsx writer in `xlsx.ts`, and the on-screen `DataTable` preview. `value` is
 * the single source of truth; the rest are optional presentation hints so the
 * three stay in step without three separate column lists.
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Right-align in the table and the spreadsheet (numbers). */
  align?: "right";
  /** Keep this column visible when the table scrolls horizontally, and freeze it in the .xlsx. */
  pin?: boolean;
  /** Rendered width in px — drives the sticky offsets on screen and the column width in the .xlsx. */
  width?: number;
  /** Renders as a link on screen; the CSV/.xlsx cell holds the URL so it stays clickable. */
  link?: (row: T) => { href: string; label: string } | null;
  /** Explicit spreadsheet cell (typed dates/numbers). Inferred from `value` when omitted. */
  cell?: (row: T) => XlsxCell;
};

function escapeCell(v: string | number | null | undefined) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The CSV cell: the link URL when the column is a link, otherwise `value`. */
function csvValue<T>(column: CsvColumn<T>, row: T) {
  const link = column.link?.(row);
  if (link) return link.href;
  return column.value(row);
}

/** RFC-4180 CSV with a UTF-8 BOM so Excel opens Hindi names correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(csvValue(c, r))).join(","));
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
