"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const routeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  site_id: z.string().uuid(),
  name: z.string().trim().min(2, "Name the round"),
  description: z.string().trim().optional(),
  frequency_min: z.coerce.number().int().min(15, "At least every 15 minutes").max(720),
  grace_min: z.coerce.number().int().min(0).max(120),
  min_photos: z.coerce.number().int().min(0).max(10),
  shift_type_id: z.string().uuid().optional().or(z.literal("")).or(z.literal("all")),
});

export async function savePatrolRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only supervisors and owners can change patrol routes." };
  const parsed = routeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const payload = {
    agency_id: session.agency.id,
    site_id: parsed.data.site_id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    frequency_min: parsed.data.frequency_min,
    grace_min: parsed.data.grace_min,
    min_photos: parsed.data.min_photos,
    shift_type_id: parsed.data.shift_type_id && parsed.data.shift_type_id !== "all" ? parsed.data.shift_type_id : null,
    created_by: session.userId,
  };
  const { error } = parsed.data.id
    ? await supabase.from("patrol_routes").update(payload).eq("id", parsed.data.id)
    : await supabase.from("patrol_routes").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/patrols/routes");
  revalidatePath("/patrols");
  return { ok: true };
}

/**
 * Rounds already walked reference their route, so a used route is paused rather than
 * deleted — the history has to stay readable.
 */
export async function setRouteActive(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.isManager) return;
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("patrol_routes").update({ is_active: active }).eq("id", id);
  revalidatePath("/patrols/routes");
}

export async function deletePatrolRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only supervisors and owners can remove patrol routes." };
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  const { count } = await supabase.from("patrols").select("id", { count: "exact", head: true }).eq("route_id", id);
  if ((count ?? 0) > 0) {
    await supabase.from("patrol_routes").update({ is_active: false }).eq("id", id);
    revalidatePath("/patrols/routes");
    return { error: `This route has ${count} recorded rounds, so it was paused instead of deleted. History stays intact.` };
  }
  const { error } = await supabase.from("patrol_routes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/patrols/routes");
  return { ok: true };
}

export async function addPatrolNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only supervisors and owners can add notes." };
  const id = String(formData.get("patrol_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.from("patrols").update({ notes: notes || null }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/patrols/${id}`);
  return { ok: true };
}

/** Signed URLs for patrol evidence (10 minutes). */
export async function patrolPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  await requireSession();
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("patrol-photos").createSignedUrls(paths, 600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
