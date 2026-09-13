"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short"),
  city: z.string().trim().optional(),
  timezone: z.string().trim().min(1, "Pick a timezone"),
  late_threshold_min: z.coerce.number().int().min(0).max(120),
  default_radius_m: z.coerce.number().int().min(10).max(2000),
  default_leeway_m: z.coerce.number().int().min(0).max(500),
  half_day_ratio: z.coerce.number().min(0.1).max(0.9),
  outage_threshold_min: z.coerce.number().int().min(1).max(180),
  staleness_min: z.coerce.number().int().min(1).max(180),
  location_off_warn_min: z.coerce.number().int().min(1).max(180),
  selfie_retention_days: z.coerce.number().int().min(1).max(3650),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm"),
});

/** Updates the agency's operational defaults. Owner/admin only — audit-logged. */
export async function updateAgency(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isOwner) return { error: "Only the owner can edit agency settings." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const before = session.agency;
  const { error } = await supabase.from("agencies").update(parsed.data).eq("id", session.agency.id);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "agency",
    entity_id: session.agency.id,
    action: "update_settings",
    before,
    after: { ...before, ...parsed.data },
  });

  revalidatePath("/settings");
  return { ok: true };
}
