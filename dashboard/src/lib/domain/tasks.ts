import type { TaskStatus } from "@/lib/supabase/types";

export type TaskDueState = "overdue" | "due_soon" | "upcoming" | "no_due" | "closed";

/**
 * How a task's due time should read on screen. Completed and missed tasks are closed —
 * their due time is history and must not be shown as urgent.
 */
export function dueState(
  task: { due_at: string | null; status: TaskStatus },
  now = new Date(),
  soonMinutes = 120,
): TaskDueState {
  if (task.status === "done" || task.status === "missed") return "closed";
  if (!task.due_at) return "no_due";
  const diffMin = (new Date(task.due_at).getTime() - now.getTime()) / 60000;
  if (diffMin < 0) return "overdue";
  if (diffMin <= soonMinutes) return "due_soon";
  return "upcoming";
}

export const DUE_TONE: Record<TaskDueState, "absent" | "half-day" | "neutral"> = {
  overdue: "absent",
  due_soon: "half-day",
  upcoming: "neutral",
  no_due: "neutral",
  closed: "neutral",
};

/** Progress across a task's assignees, which is what the supervisor actually tracks. */
export function assignmentProgress(assignments: { status: TaskStatus }[]) {
  const done = assignments.filter((a) => a.status === "done").length;
  const missed = assignments.filter((a) => a.status === "missed").length;
  return { done, missed, total: assignments.length, pct: assignments.length === 0 ? 0 : Math.round((100 * done) / assignments.length) };
}

/** A task is complete when every assignee has completed it. */
export function rollupStatus(assignments: { status: TaskStatus }[], current: TaskStatus): TaskStatus {
  if (assignments.length === 0) return current;
  if (assignments.every((a) => a.status === "done")) return "done";
  if (assignments.every((a) => a.status === "missed")) return "missed";
  if (assignments.some((a) => a.status === "in_progress" || a.status === "done")) return "in_progress";
  return current;
}
