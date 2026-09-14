"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deny, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const overrideSchema = z.object({
  shift_id: z.string().uuid(),
  attendance: z.enum(["present", "half_day", "absent", "on_leave"]),
  reason: z.string().trim().min(5, "Give a reason — it is kept in the audit trail."),
});

/** AUD-1: attendance corrections always carry a reason and are immutably logged. */
export async function overrideAttendance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "attendance:correct");
  if (denied) return denied;
  const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("override_attendance", {
    p_shift_id: parsed.data.shift_id,
    p_attendance: parsed.data.attendance,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: error.message.replace("REASON_REQUIRED", "A longer reason is required.") };

  revalidatePath(`/attendance/${parsed.data.shift_id}`);
  revalidatePath("/attendance");
  return { ok: true };
}

const exceptionSchema = z.object({
  shift_id: z.string().uuid(),
  category: z.enum(["device_failure", "gps_failure", "network", "other"]),
  reason: z.string().trim().min(10, "Describe what happened in at least 10 characters."),
});

/** LOC-3: a manager can rescue a location-off shift with a documented reason. */
export async function logShiftException(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "attendance:correct");
  if (denied) return denied;
  const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("log_shift_exception", {
    p_shift_id: parsed.data.shift_id,
    p_reason: parsed.data.reason,
    p_category: parsed.data.category,
  });
  if (error) return { error: error.message };

  revalidatePath(`/attendance/${parsed.data.shift_id}`);
  revalidatePath("/attendance");
  return { ok: true };
}

/** Signed URL for a selfie in the private `selfies` bucket (10 minutes). */
export async function selfieUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("selfies").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
