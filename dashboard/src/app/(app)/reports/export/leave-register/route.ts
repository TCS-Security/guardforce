import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadLeaveReportRows } from "@/lib/data/reports";
import { leaveColumns } from "@/lib/domain/reports";
import { toCsv, csvResponse } from "@/lib/domain/csv";
import { toLocalDate } from "@/lib/domain/format";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;
  const to = sp.get("to") ?? toLocalDate(new Date(), session.agency.timezone);
  const from = sp.get("from") ?? to;
  const rows = await loadLeaveReportRows({ from, to, siteId: sp.get("site") });
  const csv = toCsv(rows, leaveColumns(session.agency.timezone));
  return csvResponse(csv, `leave-register_${from}_${to}.csv`);
}
