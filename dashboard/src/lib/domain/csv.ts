export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function escapeCell(v: string | number | null | undefined) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC-4180 CSV with a UTF-8 BOM so Excel opens Hindi names correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(","));
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
