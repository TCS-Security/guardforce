import { Download, FileSpreadsheet } from "lucide-react";
import { Section } from "@/components/gf/section";
import { ButtonLink } from "@/components/gf/button-link";
import { EmptyState } from "@/components/gf/empty-state";
import { DataTable, type DataTableColumn } from "@/components/gf/data-table";
import type { CsvColumn } from "@/lib/domain/csv";

/** A peek, not a data dump — the download is the deliverable. */
const PREVIEW_LIMIT = 8;

/** `href` already carries the report's filters; append the format the user picked. */
function withFormat(href: string, format: "csv" | "xlsx") {
  return href.includes("?") ? `${href}&format=${format}` : `${href}?format=${format}`;
}

/** Maps the shared report column list onto the spreadsheet-style preview table. */
function toTableColumns<T>(columns: CsvColumn<T>[]): DataTableColumn<T>[] {
  return columns.map((c) => ({
    key: c.header,
    header: c.header,
    align: c.align,
    pin: c.pin,
    width: c.width,
    className: c.align === "right" ? "font-mono tabular" : undefined,
    cell: (row) => {
      const link = c.link?.(row);
      if (link) {
        return (
          <a href={link.href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
            {link.label}
          </a>
        );
      }
      const v = c.value(row);
      return v == null || v === "" ? <span className="text-muted-foreground">—</span> : String(v);
    },
  }));
}

/**
 * A report card: description, CSV + Excel download links to the route handler,
 * and a spreadsheet-shaped preview of the first few rows (pinned identity
 * columns, column dividers).
 */
export function ExportCard<T>({
  title,
  description,
  href,
  rows,
  columns,
  totalCount,
  emptyLabel,
}: {
  title?: string;
  description?: string;
  href: string;
  rows: T[];
  columns: CsvColumn<T>[];
  totalCount?: number;
  emptyLabel: string;
}) {
  const preview = rows.slice(0, PREVIEW_LIMIT);
  const total = totalCount ?? rows.length;
  const label = title || "Report";
  const downloadButtons = (
    <>
      <ButtonLink href={withFormat(href, "csv")} variant="outline" size="sm" prefetch={false} aria-label={`Download ${label} as CSV`}>
        <Download data-icon="inline-start" /> CSV
      </ButtonLink>
      <ButtonLink href={withFormat(href, "xlsx")} variant="outline" size="sm" prefetch={false} aria-label={`Download ${label} as Excel`}>
        <FileSpreadsheet data-icon="inline-start" /> Excel
      </ButtonLink>
    </>
  );

  const body = (
    <>
      <DataTable
        dense
        columns={toTableColumns(columns)}
        rows={preview}
        rowKey={(_, i) => String(i)}
        ariaLabel={`${label} preview`}
        empty={<EmptyState title="Nothing to export" description={emptyLabel} className="border-0" />}
      />
      {preview.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Preview of {preview.length} · {total} row{total === 1 ? "" : "s"} in the download.
        </div>
      )}
    </>
  );

  if (!title) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="flex justify-end gap-1.5 border-b bg-muted/30 px-3 py-1.5">{downloadButtons}</div>
        {body}
      </div>
    );
  }

  return (
    <Section title={title} description={description} actions={downloadButtons} bodyClassName="p-0">
      {body}
    </Section>
  );
}
