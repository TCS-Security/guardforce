"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

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

// ---------------------------------------------------------------------------
// Team (F1 roles, ROLE-1)
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
  role: z.enum(["admin", "supervisor"]),
  site_ids: z.string().optional(),
});

export type InviteState = { error?: string; password?: string; email?: string } | undefined;

/**
 * Creates a dashboard login for a supervisor or admin. Uses the service role because
 * only it can mint auth users; the caller is checked first.
 */
export async function inviteTeamMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const session = await requireSession();
  if (!session.isOwner) return { error: "Only owners and admins can invite team members." };

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const siteIds = (parsed.data.site_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parsed.data.role === "supervisor" && siteIds.length === 0) {
    return { error: "Pick at least one site — supervisors only see the sites they are scoped to." };
  }

  const admin = createAdminClient();
  const password = generatePassword();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { error: authError?.message.includes("already") ? "That email already has an account." : authError?.message ?? "Could not create the login." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    agency_id: session.agency.id,
    role: parsed.data.role,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  if (siteIds.length > 0) {
    await admin.from("supervisor_sites").insert(
      siteIds.map((site_id) => ({ profile_id: created.user!.id, site_id, agency_id: session.agency.id })),
    );
  }

  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "profile",
    entity_id: created.user.id,
    action: "team_member_invited",
    after: { email: parsed.data.email, role: parsed.data.role, sites: siteIds.length },
  });

  revalidatePath("/settings/team");
  return { password, email: parsed.data.email };
}

/** Readable one-off password: the owner reads it out or pastes it into WhatsApp. */
function generatePassword() {
  const words = ["gate", "post", "shift", "round", "watch", "beat", "guard", "relay"];
  const w = () => words[Math.floor(Math.random() * words.length)]!;
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 8999)}`;
}

export async function updateTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isOwner) return { error: "Only owners and admins can change team access." };
  const profileId = String(formData.get("profile_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const siteIds = String(formData.get("site_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!["admin", "supervisor", "owner"].includes(role)) return { error: "Unknown role" };
  if (role === "supervisor" && siteIds.length === 0) return { error: "A supervisor needs at least one site." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: role as "admin" | "supervisor" | "owner" }).eq("id", profileId);
  if (error) return { error: error.message };

  await supabase.from("supervisor_sites").delete().eq("profile_id", profileId);
  if (role !== "owner" && siteIds.length > 0) {
    await supabase.from("supervisor_sites").insert(siteIds.map((site_id) => ({ profile_id: profileId, site_id, agency_id: session.agency.id })));
  }
  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "profile",
    entity_id: profileId,
    action: "team_member_updated",
    after: { role, sites: siteIds.length },
  });
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function setTeamMemberActive(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.isOwner) return;
  const profileId = String(formData.get("profile_id") ?? "");
  const active = formData.get("active") === "true";
  if (profileId === session.userId) return; // cannot lock yourself out

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: active }).eq("id", profileId);
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(profileId, { ban_duration: active ? "none" : "876000h" });
  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "profile",
    entity_id: profileId,
    action: active ? "team_member_reactivated" : "team_member_deactivated",
  });
  revalidatePath("/settings/team");
}

// ---------------------------------------------------------------------------
// Notifications (F10)
// ---------------------------------------------------------------------------
export async function updateNotificationPreferences(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const flag = (name: string) => formData.get(name) === "on" || formData.get(name) === "true";
  const whatsapp = String(formData.get("whatsapp_number") ?? "").trim();
  if (whatsapp && !/^\d{10,14}$/.test(whatsapp)) return { error: "WhatsApp number should be 10–14 digits, country code first." };

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({
    profile_id: session.userId,
    agency_id: session.agency.id,
    late_start: flag("late_start"),
    fence_exit: flag("fence_exit"),
    location_off: flag("location_off"),
    outage: flag("outage"),
    patrol_missed: flag("patrol_missed"),
    leave_requests: flag("leave_requests"),
    daily_digest: flag("daily_digest"),
    whatsapp_number: whatsapp || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings/notifications");
  return { ok: true };
}

export async function markNotificationsRead(formData: FormData): Promise<void> {
  await requireSession();
  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ status: "read", read_at: new Date().toISOString() }).in("id", ids);
  revalidatePath("/settings/notifications");
}

// ---------------------------------------------------------------------------
// Guard app remote config (drives OTA behaviour on the Android app)
// ---------------------------------------------------------------------------
const appConfigSchema = z.object({
  min_app_version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Use a semver like 1.2.0"),
  ota_channel: z.enum(["production", "beta", "canary"]),
  ping_interval_moving_s: z.coerce.number().int().min(30).max(1800),
  ping_interval_stationary_s: z.coerce.number().int().min(60).max(3600),
  selfie_max_kb: z.coerce.number().int().min(40).max(1024),
  photo_max_kb: z.coerce.number().int().min(60).max(4096),
  features: z.string().optional(),
});

export async function updateAppConfig(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isOwner) return { error: "Only owners and admins can change the guard-app config." };
  const parsed = appConfigSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  let features: Json = {};
  const raw = (parsed.data.features ?? "").trim();
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
      features = value as Json;
    } catch {
      return { error: "Feature flags must be a JSON object, e.g. {\"alertness_checks\": true}" };
    }
  }
  if (parsed.data.ping_interval_stationary_s < parsed.data.ping_interval_moving_s) {
    return { error: "The stationary interval should not be shorter than the moving one." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_config").upsert({
    agency_id: session.agency.id,
    min_app_version: parsed.data.min_app_version,
    ota_channel: parsed.data.ota_channel,
    ping_interval_moving_s: parsed.data.ping_interval_moving_s,
    ping_interval_stationary_s: parsed.data.ping_interval_stationary_s,
    selfie_max_kb: parsed.data.selfie_max_kb,
    photo_max_kb: parsed.data.photo_max_kb,
    features,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "app_config",
    entity_id: session.agency.id,
    action: "app_config_updated",
    after: { ota_channel: parsed.data.ota_channel, min_app_version: parsed.data.min_app_version, features },
  });
  revalidatePath("/settings/app");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Own profile
// ---------------------------------------------------------------------------
export async function updateOwnProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (full_name.length < 2) return { error: "Name is too short" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name, phone: phone || null }).eq("id", session.userId);
  if (error) return { error: error.message };
  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeOwnPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}
