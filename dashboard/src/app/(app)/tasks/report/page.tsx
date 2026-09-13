import type { Metadata } from "next";
import { ImageOff } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadTaskReport } from "@/lib/data/tasks";
import { taskPhotoUrls } from "../actions";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { Mono } from "@/components/gf/mono";
import { TaskStatusBadge } from "@/components/gf/attendance-badge";
import { DayFilter } from "@/components/patrols/day-filter";
import { fmtTime, toLocalDate } from "@/lib/domain/format";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "Task report" };
export const dynamic = "force-dynamic";

type Assignment = { status: string; completed_at: string | null; note: string | null; photo_path: string | null; guards: { full_name: string } | null };

export default async function TaskReportPage({ searchParams }: PageProps<"/tasks/report">) {
  const session = await requireSession();
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toLocalDate(new Date(), session.agency.timezone);
  const siteId = typeof sp.site === "string" ? sp.site : null;

  const { rows, sites } = await loadTaskReport(session, date, siteId);
  const allPhotos = rows.flatMap((t) => (t.task_assignments as Assignment[]).map((a) => a.photo_path).filter((p): p is string => !!p));
  const urls = await taskPhotoUrls(allPhotos);
  const exportHref = `/tasks/report/export?date=${date}${siteId ? `&site=${siteId}` : ""}`;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <PageHeader
        eyebrow="Tasks"
        title="Task report"
        description="What was asked of each post on a given day, and the evidence that came back."
        actions={
          <ButtonLink href={exportHref} variant="outline" prefetch={false}>
            <Download data-icon="inline-start" /> CSV
          </ButtonLink>
        }
      />

      <DayFilter date={date} siteId={siteId} sites={sites} basePath="/tasks/report" />

      {rows.length === 0 ? (
        <EmptyState title="No tasks due on this day" description="Pick another day, or clear the site filter." />
      ) : (
        <Section title={`${rows.length} task${rows.length === 1 ? "" : "s"}`} bodyClassName="p-0" style={{ ["--i" as string]: 2 }}>
          <ul className="divide-y">
            {rows.map((t) => {
              const assignments = t.task_assignments as Assignment[];
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.title}</span>
                    <TaskStatusBadge status={t.status} size="xs" />
                    <Mono className="text-[11px] text-muted-foreground">
                      {(t.sites as { name?: string } | null)?.name} · due {fmtTime(t.due_at, session.agency.timezone)}
                    </Mono>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-3">
                    {assignments.map((a, i) => {
                      const url = a.photo_path ? urls[a.photo_path] : null;
                      return (
                        <li key={i} className="flex w-[200px] gap-2 rounded-md border p-2">
                          <div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={`Proof from ${a.guards?.full_name}`} className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <ImageOff className="size-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{a.guards?.full_name}</div>
                            <TaskStatusBadge status={a.status as never} size="xs" />
                            {a.completed_at && <Mono className="block text-[10px] text-muted-foreground">{fmtTime(a.completed_at, session.agency.timezone)}</Mono>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
