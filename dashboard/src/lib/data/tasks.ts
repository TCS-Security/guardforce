import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import type { TaskStatus } from "@/lib/supabase/types";

export type TaskRow = {
  id: string;
  site_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  photo_required: boolean;
  status: TaskStatus;
  created_at: string;
  sites: { name: string } | null;
  task_assignments: { guard_id: string; status: TaskStatus; completed_at: string | null; guards: { full_name: string } | null }[];
};

export type TaskFilters = { siteId: string | null; status: string | null; due: string | null; guardId: string | null };

export async function loadTasks(session: Session, filters: TaskFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("id,site_id,title,description,due_at,photo_required,status,created_at,sites(name),task_assignments(guard_id,status,completed_at,guards(full_name))")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.status) query = query.eq("status", filters.status as never);

  const now = new Date();
  if (filters.due === "overdue") query = query.lt("due_at", now.toISOString()).in("status", ["pending", "in_progress"]);
  if (filters.due === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    query = query.lte("due_at", end.toISOString()).gte("due_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
  }
  if (filters.due === "upcoming") query = query.gt("due_at", now.toISOString());

  const [{ data }, { data: sites }, { data: guards }, { data: templates }] = await Promise.all([
    query,
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
    supabase.from("guards").select("id,full_name,site_id").neq("status", "inactive").order("full_name"),
    supabase.from("task_templates").select("*").order("title"),
  ]);

  let rows = (data ?? []) as unknown as TaskRow[];
  if (filters.guardId) rows = rows.filter((t) => t.task_assignments.some((a) => a.guard_id === filters.guardId));

  return { rows, sites: sites ?? [], guards: guards ?? [], templates: templates ?? [] };
}

export async function loadTask(session: Session, taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("*,sites(id,name),task_templates(title)")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return null;

  const [{ data: assignments }, { data: guards }] = await Promise.all([
    supabase
      .from("task_assignments")
      .select("*,guards(id,full_name,employee_code)")
      .eq("task_id", taskId),
    supabase.from("guards").select("id,full_name,site_id").neq("status", "inactive").order("full_name"),
  ]);
  return { task, assignments: assignments ?? [], guards: guards ?? [] };
}

/** Task report for a site and day: every task with its completion evidence. */
export async function loadTaskReport(session: Session, date: string, siteId: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id,title,due_at,status,photo_required,sites(name),task_assignments(status,completed_at,note,photo_path,guards(full_name))")
    .gte("due_at", `${date}T00:00:00+05:30`)
    .lte("due_at", `${date}T23:59:59+05:30`)
    .order("due_at");
  if (siteId) query = query.eq("site_id", siteId);

  const [{ data }, { data: sites }] = await Promise.all([
    query,
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
  ]);
  return { rows: data ?? [], sites: sites ?? [] };
}
