import type { CsvColumn } from "./csv";
import { csvResponse, toCsv } from "./csv";
import { toXlsx, xlsxResponse } from "./xlsx";

export type ExportFormat = "csv" | "xlsx";

/** `?format=xlsx` opts into the spreadsheet; anything else is CSV. */
export function exportFormat(value: string | null | undefined): ExportFormat {
  return value === "xlsx" || value === "excel" ? "xlsx" : "csv";
}

/**
 * One download in either format from one column list, so the CSV and the .xlsx
 * can never drift apart. The CSV already opens cleanly in Excel and Google
 * Sheets (UTF-8 BOM); the .xlsx adds typed cells, a bold header and frozen
 * panes for the pinned columns.
 */
export function reportDownload<T>({
  format,
  rows,
  columns,
  basename,
  name,
}: {
  format: ExportFormat;
  rows: T[];
  columns: CsvColumn<T>[];
  /** Filename without an extension. */
  basename: string;
  /** Sheet tab name. */
  name: string;
}) {
  if (format === "xlsx") return xlsxResponse(toXlsx({ rows, columns, name }), `${basename}.xlsx`);
  return csvResponse(toCsv(rows, columns), `${basename}.csv`);
}
