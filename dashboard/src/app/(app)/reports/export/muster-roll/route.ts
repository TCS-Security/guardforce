import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadMusterRows } from "@/lib/data/reports";
import { buildMusterMatrix, daysInRange, monthRange, musterColumns } from "@/lib/domain/reports";
import { toCsv, csvResponse } from "@/lib/domain/csv";
import { toLocalDate } from "@/lib/domain/format";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;
  const month = sp.get("month") ?? toLocalDate(new Date(), session.agency.timezone).slice(0, 7);
  const { from, to } = monthRange(month);
  const rows = await loadMusterRows({ from, to, siteId: sp.get("site") });
  const days = daysInRange(from, to);
  const matrix = buildMusterMatrix(rows, days);
  const csv = toCsv(matrix, musterColumns(days));
  return csvResponse(csv, `muster-roll_${month}.csv`);
}
