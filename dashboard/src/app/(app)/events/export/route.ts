import { requireSession } from "@/lib/auth/session";
import { loadEvents, parseEventFilters } from "@/lib/data/events";
import { csvResponse, toCsv } from "@/lib/domain/csv";
import { EVENT_META } from "@/lib/domain/status";
import { toLocalDate } from "@/lib/domain/format";
import { formatInTimeZone } from "date-fns-tz";

/** CSV of the filtered event feed (REP-1). Reads the same params as the page. */
export async function GET(request: Request) {
  const session = await requireSession();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseEventFilters(sp, toLocalDate(new Date(), session.agency.timezone));
  const { rows } = await loadEvents(session, { ...filters, page: 1 });

  const csv = toCsv(rows, [
    { header: "Time", value: (r) => formatInTimeZone(new Date(r.created_at), session.agency.timezone, "yyyy-MM-dd HH:mm:ss") },
    { header: "Severity", value: (r) => r.severity },
    { header: "Type", value: (r) => EVENT_META[r.type]?.label ?? r.type },
    { header: "Title", value: (r) => r.title },
    { header: "Site", value: (r) => r.sites?.name ?? "" },
    { header: "Guard", value: (r) => r.guards?.full_name ?? "" },
    { header: "Guard code", value: (r) => r.guards?.employee_code ?? "" },
    { header: "Acknowledged", value: (r) => (r.acknowledged_at ? "yes" : "no") },
    { header: "Details", value: (r) => JSON.stringify(r.payload ?? {}) },
  ]);
  return csvResponse(csv, `events-${filters.from}-to-${filters.to}.csv`);
}
