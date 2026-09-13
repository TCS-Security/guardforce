import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadPatrolReportRows } from "@/lib/data/reports";
import { patrolColumns, toPatrolExportRows } from "@/lib/domain/reports";
import { toCsv, csvResponse } from "@/lib/domain/csv";
import { toLocalDate } from "@/lib/domain/format";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;
  const to = sp.get("to") ?? toLocalDate(new Date(), session.agency.timezone);
  const from = sp.get("from") ?? to;
  const rows = await loadPatrolReportRows({ from, to, siteId: sp.get("site") });
  const csv = toCsv(toPatrolExportRows(rows), patrolColumns(session.agency.timezone));
  return csvResponse(csv, `patrol-compliance_${from}_${to}.csv`);
}
