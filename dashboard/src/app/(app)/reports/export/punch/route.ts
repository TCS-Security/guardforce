import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadShiftReportRows } from "@/lib/data/reports";
import { punchColumns, toPunchRows } from "@/lib/domain/reports";
import { toCsv, csvResponse } from "@/lib/domain/csv";
import { toLocalDate } from "@/lib/domain/format";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;
  const to = sp.get("to") ?? toLocalDate(new Date(), session.agency.timezone);
  const from = sp.get("from") ?? to;
  const rows = await loadShiftReportRows({ from, to, siteId: sp.get("site"), guardId: sp.get("guard") });
  const csv = toCsv(toPunchRows(rows), punchColumns(session.agency.timezone));
  return csvResponse(csv, `punch-in-out_${from}_${to}.csv`);
}
