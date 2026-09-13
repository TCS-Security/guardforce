"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const taskSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  site_id: z.string().uuid("Pick a site"),
  template_id: z.string().uuid().optional().or(z.literal("")).or(z.literal("none")),
  title: z.string().trim().min(2, "Give the task a title"),
  description: z.string().trim().optional(),
  due_at: z.string().optional(),
  photo_required: z.string().optional(),
  guard_ids: z.string().optional(),
});

export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only supervisors and owners can manage tasks." };
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const guardIds = (parsed.data.guard_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (guardIds.length === 0) return { error: "Assign the task to at least one guard." };

  const supabase = await createClient();
  const payload = {
    agency_id: session.agency.id,
    site_id: parsed.data.site_id,
    template_id: parsed.data.template_id && parsed.data.template_id !== "none" ? parsed.data.template_id : null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
    photo_required: formData.get("photo_required") === "on" || formData.get("photo_required") === "true",
    created_by: session.userId,
  };

  const taskId = parsed.data.id || null;
  let id = taskId;
  if (taskId) {
    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
    if (error) return { error: error.message };
    await supabase.from("task_assignments").delete().eq("task_id", taskId);
  } else {
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (error) return { error: error.message };
    id = data.id;
  }

  const { error: assignError } = await supabase.from("task_assignments").insert(
    guardIds.map((guard_id) => ({ task_id: id!, guard_id, agency_id: session.agency.id })),
  );
  if (assignError) return { error: assignError.message };

  revalidatePath("/tasks");
  if (!taskId) redirect(`/tasks/${id}`);
  revalidatePath(`/tasks/${id}`);
  return { ok: true };
}

export async function setTaskStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.isManager) return;
  const id = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["pending", "in_progress", "done", "missed"].includes(status)) return;

  const supabase = await createClient();
  const { error: taskError } = await supabase
    .from("tasks")
    .update({ status: status as "pending" | "in_progress" | "done" | "missed" })
    .eq("id", id);
  if (taskError) throw new Error(`Could not update the task: ${taskError.message}`);

  if (status === "missed") {
    // Anyone who had not already closed it is missed too — that is what the report shows.
    const { error } = await supabase
      .from("task_assignments")
      .update({ status: "missed" })
      .eq("task_id", id)
      .neq("status", "done");
    if (error) throw new Error(`Could not update the assignees: ${error.message}`);
  }
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
}

export async function deleteTask(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.isManager) return;
  const id = String(formData.get("task_id") ?? "");
  const supabase = await createClient();
  await supabase.from("task_assignments").delete().eq("task_id", id);
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
  redirect("/tasks");
}

const templateSchema = z.object({
  title: z.string().trim().min(2, "Name the template"),
  description: z.string().trim().optional(),
  photo_required: z.string().optional(),
});

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only supervisors and owners can add templates." };
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").insert({
    agency_id: session.agency.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    photo_required: formData.get("photo_required") === "on" || formData.get("photo_required") === "true",
  });
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

/** Signed URLs for task completion photos (10 minutes). */
export async function taskPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  await requireSession();
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("task-photos").createSignedUrls(paths, 600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
