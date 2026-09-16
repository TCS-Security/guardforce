import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadMusterRows } from "@/lib/data/reports";
import { buildMusterMatrix, daysInRange, monthRange, musterColumns } from "@/lib/domain/reports";
import { exportFormat, reportDownload } from "@/lib/domain/export";
import { toLocalDate } from "@/lib/domain/format";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;
  const month = sp.get("month") ?? toLocalDate(new Date(), session.agency.timezone).slice(0, 7);
  const { from, to } = monthRange(month);
  const rows = await loadMusterRows({ from, to, siteId: sp.get("site") });
  const days = daysInRange(from, to);
  const matrix = buildMusterMatrix(rows, days);
  return reportDownload({
    format: exportFormat(sp.get("format")),
    rows: matrix,
    columns: musterColumns(days),
    basename: `muster-roll_${month}`,
    name: `Muster ${month}`,
  });
}
