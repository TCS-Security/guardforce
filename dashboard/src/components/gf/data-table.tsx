import { cn } from "cn";

/**
 * A spreadsheet-shaped table: vertical column dividers, and the leading
 * identity columns (guard, employee code, date) pinned so they stay on screen
 * when you scroll right — the way frozen columns work in Google Sheets.
 *
 * Pinned columns need an explicit `width`, because the sticky `left` offset of
 * each one is the sum of the widths before it. Below `sm` the pinning is turned
 * off (`static`): on a phone there is no room to lose a third of the viewport
 * to frozen columns, and the table simply scrolls.
 *
 * Deliberately not a client component — the reports page renders most of these
 * on the server, and `ScorecardTable` (which is a client component) reuses it.
 */
export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: "right";
  /** Sticky-left. Requires `width`. */
  pin?: boolean;
  /** Rendered width in px. Required on pinned columns, optional elsewhere. */
  width?: number;
  className?: string;
  headClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  empty,
  dense,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  ariaLabel: string;
  /** Rendered in place of the body when there are no rows. */
  empty?: React.ReactNode;
  /** Tighter padding and smaller type, for the export previews. */
  dense?: boolean;
  className?: string;
}) {
  // Cumulative sticky offsets: a pinned column sits to the right of every
  // pinned column declared before it.
  const offsets: number[] = [];
  let run = 0;
  for (const c of columns) {
    offsets.push(run);
    if (c.pin) run += c.width ?? 0;
  }
  const lastPinned = columns.reduce((acc, c, i) => (c.pin ? i : acc), -1);

  const pad = dense ? "px-3 py-1.5" : "px-3 py-2";
  const text = dense ? "text-xs" : "text-sm";

  function cellClass(c: DataTableColumn<T>, i: number, head: boolean) {
    return cn(
      pad,
      "border-b border-border",
      i < columns.length - 1 && "border-r",
      c.align === "right" && "text-right",
      c.pin && "static sm:sticky sm:z-10",
      head && "bg-card",
      c.pin && !head && "bg-card group-hover:bg-muted/50",
      i === lastPinned && "sm:shadow-[1px_0_0_0_var(--border)]",
      head && c.pin && "sm:z-20",
      c.className,
    );
  }

  return (
    <div className={cn("relative w-full overflow-x-auto", className)}>
      <table
        className={cn("w-full border-separate border-spacing-0 whitespace-nowrap", text)}
        aria-label={ariaLabel}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width, minWidth: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-left">
            {columns.map((c, i) => (
              <th
                key={c.key}
                scope="col"
                style={c.pin ? { left: offsets[i] } : undefined}
                className={cn("eyebrow font-normal", cellClass(c, i, true), c.headClassName)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="border-b p-0">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, r) => (
              <tr key={rowKey(row, r)} className="group transition-colors hover:bg-muted/50">
                {columns.map((c, i) => (
                  <td key={c.key} style={c.pin ? { left: offsets[i] } : undefined} className={cellClass(c, i, false)}>
                    {c.cell(row, r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
