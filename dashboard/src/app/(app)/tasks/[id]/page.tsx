import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadTask } from "@/lib/data/tasks";
import { taskPhotoUrls } from "../actions";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { KvList } from "@/components/gf/kv";
import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { TaskStatusBadge } from "@/components/gf/attendance-badge";
import { TaskAdminBar } from "@/components/tasks/task-admin-bar";
import { assignmentProgress, dueState, DUE_TONE } from "@/lib/domain/tasks";
import { fmtDateTime } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/tasks/[id]">): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const data = await loadTask(session, id);
  return { title: data?.task.title ?? "Task" };
}

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const data = await loadTask(session, id);
  if (!data) notFound();

  const { task, assignments } = data;
  const site = task.sites as unknown as { id: string; name: string } | null;
  const tz = session.agency.timezone;
  const photos = assignments.map((a) => a.photo_path).filter((p): p is string => !!p);
  const urls = await taskPhotoUrls(photos);
  const progress = assignmentProgress(assignments);
  const state = dueState(task, new Date());

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      <PageHeader
        eyebrow={
          <>
            <Link href="/tasks" className="hover:text-foreground">Tasks</Link>
            {site && <> · <Link href={`/sites/${site.id}`} className="hover:text-foreground">{site.name}</Link></>}
          </>
        }
        title={task.title}
        description={task.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <TaskStatusBadge status={task.status} />
            {session.isManager && <TaskAdminBar taskId={task.id} status={task.status} />}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Section title={`Assignees (${progress.done}/${progress.total} done)`} bodyClassName="p-0" style={{ ["--i" as string]: 1 }}>
          <ul className="divide-y">
            {assignments.map((a) => {
              const guard = a.guards as unknown as { id: string; full_name: string; employee_code: string | null } | null;
              const url = a.photo_path ? urls[a.photo_path] : null;
              return (
                <li key={a.guard_id} className="flex items-start gap-3 px-4 py-3">
                  <GuardAvatar name={guard?.full_name ?? "Guard"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/guards/${guard?.id}`} className="text-sm font-medium hover:underline">{guard?.full_name}</Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <TaskStatusBadge status={a.status} size="xs" />
                      {a.completed_at && <Mono className="text-[11px] text-muted-foreground">closed {fmtDateTime(a.completed_at, tz)}</Mono>}
                    </div>
                    {a.note && <p className="mt-1 text-xs text-muted-foreground">“{a.note}”</p>}
                  </div>
                  {a.photo_path && (
                    <div className="size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`Proof from ${guard?.full_name}`} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                          <ImageOff className="size-3.5" />
                          <span className="text-[9px]">no photo</span>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Details" style={{ ["--i" as string]: 2 }}>
          <KvList
            items={[
              { k: "Site", v: site?.name ?? "—" },
              {
                k: "Due",
                v: task.due_at ? (
                  <span className="flex items-center gap-1.5">
                    <Mono>{fmtDateTime(task.due_at, tz)}</Mono>
                    {state === "overdue" && <StatusPill tone={DUE_TONE.overdue} size="xs" dot={false}>overdue</StatusPill>}
                  </span>
                ) : "No due time",
              },
              { k: "Photo proof", v: task.photo_required ? "Required" : "Optional" },
              { k: "Created", v: <Mono>{fmtDateTime(task.created_at, tz)}</Mono> },
              { k: "Template", v: (task.task_templates as { title?: string } | null)?.title ?? "—" },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
