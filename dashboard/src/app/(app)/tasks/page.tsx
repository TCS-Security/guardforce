import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadTasks } from "@/lib/data/tasks";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { TaskStatusBadge } from "@/components/gf/attendance-badge";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { DUE_TONE, assignmentProgress, dueState } from "@/lib/domain/tasks";
import { fmtDateTime } from "@/lib/domain/format";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

const DUE_LABEL = { overdue: "overdue", due_soon: "due soon", upcoming: "", no_due: "no due time", closed: "" } as const;

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await requireSession();
  requirePermission(session, "tasks:read");
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v !== "all" ? v : null);

  const filters = { siteId: str(sp.site), status: str(sp.status), due: str(sp.due), guardId: str(sp.guard) };
  const { rows, sites, guards, templates } = await loadTasks(session, filters);
  const now = new Date();

  return (
    <div className="mx-auto flex max-w-[1300px] flex-col gap-5">
      <PageHeader
        eyebrow="Proof of work"
        title="Tasks"
        description="Standing checks and one-off jobs, each closed with a photo from the post."
        actions={
          session.can("tasks:write") ? (
            <div className="flex gap-2">
              <ButtonLink href="/tasks/report" variant="outline">Report</ButtonLink>
              <NewTaskDialog sites={sites} guards={guards} templates={templates} />
            </div>
          ) : (
            <ButtonLink href="/tasks/report" variant="outline">Report</ButtonLink>
          )
        }
      />

      <TaskFiltersBar sites={sites} guards={guards} current={filters} />

      <Section title={`${rows.length} task${rows.length === 1 ? "" : "s"}`} bodyClassName="p-0" style={{ ["--i" as string]: 2 }}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="No tasks match"
            description="Clear a filter, or create the first task for this site."
            className="border-0"
          />
        ) : (
          <table className="w-full text-sm" aria-label="Tasks">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Task</th>
                <th>Site</th>
                <th>Assigned</th>
                <th>Due</th>
                <th className="text-right">Progress</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => {
                const state = dueState(t, now);
                const progress = assignmentProgress(t.task_assignments);
                return (
                  <tr key={t.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      {t.photo_required && <StatusPill tone="olive" size="xs" dot={false} className="ml-2">photo</StatusPill>}
                      {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.sites?.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex -space-x-1.5">
                        {t.task_assignments.slice(0, 4).map((a) => (
                          <GuardAvatar key={a.guard_id} name={a.guards?.full_name ?? "Guard"} size="xs" className="ring-2 ring-card" />
                        ))}
                        {t.task_assignments.length > 4 && (
                          <span className="ml-2.5 self-center text-xs text-muted-foreground">+{t.task_assignments.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Mono className={state === "overdue" ? "text-absent" : state === "due_soon" ? "text-half-day-foreground dark:text-half-day" : "text-muted-foreground"}>
                        {t.due_at ? fmtDateTime(t.due_at, session.agency.timezone) : "—"}
                      </Mono>
                      {DUE_LABEL[state] && (
                        <StatusPill tone={DUE_TONE[state]} size="xs" dot={false} className="ml-1.5">{DUE_LABEL[state]}</StatusPill>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Mono>{progress.done}/{progress.total}</Mono>
                    </td>
                    <td className="px-4 py-2.5 text-right"><TaskStatusBadge status={t.status} size="xs" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
