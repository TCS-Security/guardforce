import { Download } from "lucide-react";
import { Section } from "@/components/gf/section";
import { ButtonLink } from "@/components/gf/button-link";
import { EmptyState } from "@/components/gf/empty-state";
import type { CsvColumn } from "@/lib/domain/csv";

const PREVIEW_LIMIT = 50;

/** A CSV report card: description, "Download CSV" link to the route handler, and a preview of the first 50 rows. */
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
  const downloadButton = (
    <ButtonLink href={href} variant="outline" size="sm" prefetch={false}>
      <Download data-icon="inline-start" /> Download CSV
    </ButtonLink>
  );
  const body = preview.length === 0 ? (
    <EmptyState title="Nothing to export" description={emptyLabel} className="border-0" />
  ) : (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label={`${title || "Report"} preview`}>
          <thead>
            <tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-1.5 [&>th]:font-normal [&>th]:whitespace-nowrap">
              {columns.map((c) => (
                <th key={c.header}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {preview.map((row, i) => (
              <tr key={i} className="hover:bg-muted/50">
                {columns.map((c) => (
                  <td key={c.header} className="px-3 py-1.5 font-mono tabular whitespace-nowrap">{String(c.value(row) ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        Showing {preview.length} of {total} row{total === 1 ? "" : "s"}.
      </div>
    </>
  );

  if (!title) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <div className="flex justify-end border-b bg-muted/30 px-3 py-1.5">{downloadButton}</div>
        {body}
      </div>
    );
  }

  return (
    <Section title={title} description={description} actions={downloadButton} bodyClassName="p-0">
      {body}
    </Section>
  );
}
