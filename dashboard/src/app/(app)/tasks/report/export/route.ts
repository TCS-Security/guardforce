import { requireSession } from "@/lib/auth/session";
import { loadTaskReport } from "@/lib/data/tasks";
import { csvResponse, toCsv } from "@/lib/domain/csv";
import { toLocalDate } from "@/lib/domain/format";
import { formatInTimeZone } from "date-fns-tz";

type Assignment = { status: string; completed_at: string | null; note: string | null; photo_path: string | null; guards: { full_name: string } | null };

/** One row per assignee, which is how a client wants to read the day's proof of work. */
export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? toLocalDate(new Date(), session.agency.timezone);
  const siteId = url.searchParams.get("site");

  const { rows } = await loadTaskReport(session, date, siteId);
  const flat = rows.flatMap((t) =>
    (t.task_assignments as Assignment[]).map((a) => ({ task: t, assignment: a })),
  );

  const time = (v: string | null) => (v ? formatInTimeZone(new Date(v), session.agency.timezone, "yyyy-MM-dd HH:mm") : "");
  const csv = toCsv(flat, [
    { header: "Date", value: () => date },
    { header: "Site", value: (r) => (r.task.sites as { name?: string } | null)?.name ?? "" },
    { header: "Task", value: (r) => r.task.title },
    { header: "Due", value: (r) => time(r.task.due_at) },
    { header: "Guard", value: (r) => r.assignment.guards?.full_name ?? "" },
    { header: "Status", value: (r) => r.assignment.status },
    { header: "Completed", value: (r) => time(r.assignment.completed_at) },
    { header: "Photo required", value: (r) => (r.task.photo_required ? "yes" : "no") },
    { header: "Photo captured", value: (r) => (r.assignment.photo_path ? "yes" : "no") },
    { header: "Note", value: (r) => r.assignment.note ?? "" },
  ]);
  return csvResponse(csv, `task-report-${date}.csv`);
}
