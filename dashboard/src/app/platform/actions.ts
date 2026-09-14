"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";

export type PlatformActionState = { error?: string; ok?: boolean; password?: string; email?: string } | undefined;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Readable one-off password the platform admin passes on to the new owner. */
function generatePassword() {
  const words = ["gate", "post", "shift", "round", "watch", "beat", "guard", "relay"];
  const w = () => words[Math.floor(Math.random() * words.length)]!;
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 8999)}`;
}

const tenantSchema = z.object({
  name: z.string().trim().min(2, "Agency name is required"),
  slug: z.string().trim().optional(),
  city: z.string().trim().optional(),
  plan: z.enum(["pilot", "starter", "growth", "scale"]),
  status: z.enum(["trial", "active"]),
  max_guards: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("")),
  owner_name: z.string().trim().min(2, "Owner name is required"),
  owner_email: z.string().trim().email("Enter the owner's email"),
  owner_phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * Onboards a tenant: the agency row (roles and app config are seeded by trigger), the
 * first owner login, and their profile. Everything runs as the service role because a
 * platform admin is not a member of the tenant being created.
 */
export async function createTenant(_prev: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const { admin, db } = await requirePlatformAdmin();
  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const slug = slugify(d.slug || d.name);
  if (!slug) return { error: "Could not derive a slug from that name." };

  const { data: agency, error: agencyError } = await db
    .from("agencies")
    .insert({
      name: d.name,
      slug,
      city: d.city || null,
      plan: d.plan,
      status: d.status,
      max_guards: d.max_guards === "" || d.max_guards == null ? null : d.max_guards,
      notes: d.notes || null,
    })
    .select("id")
    .single();
  if (agencyError) {
    return { error: agencyError.message.includes("agencies_slug_key") ? "That slug is taken. Pick another." : agencyError.message };
  }

  const password = generatePassword();
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: d.owner_email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    await db.from("agencies").delete().eq("id", agency.id);
    return { error: authError?.message.includes("already") ? "That email already has a login." : authError?.message ?? "Could not create the owner login." };
  }

  const { data: ownerRole } = await db.from("roles").select("id").eq("agency_id", agency.id).eq("system_key", "owner").single();
  const { error: profileError } = await db.from("profiles").insert({
    id: created.user.id,
    agency_id: agency.id,
    role: "owner",
    role_id: ownerRole?.id ?? null,
    all_sites: true,
    full_name: d.owner_name,
    email: d.owner_email,
    phone: d.owner_phone || null,
  });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id);
    await db.from("agencies").delete().eq("id", agency.id);
    return { error: profileError.message };
  }

  await db.from("audit_logs").insert({
    agency_id: agency.id,
    platform_actor_id: admin.user_id,
    entity_type: "agency",
    entity_id: agency.id,
    action: "tenant_created",
    after: { name: d.name, plan: d.plan, status: d.status, owner: d.owner_email },
  });

  revalidatePath("/platform");
  redirect(`/platform/tenants/${agency.id}?owner=${encodeURIComponent(d.owner_email)}&password=${encodeURIComponent(password)}`);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2),
  city: z.string().trim().optional(),
  plan: z.enum(["pilot", "starter", "growth", "scale"]),
  max_guards: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export async function updateTenant(_prev: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const { admin, db } = await requirePlatformAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;

  const { data: before } = await db.from("agencies").select("name,plan,max_guards").eq("id", d.id).single();
  const { error } = await db
    .from("agencies")
    .update({ name: d.name, city: d.city || null, plan: d.plan, max_guards: d.max_guards === "" || d.max_guards == null ? null : d.max_guards, notes: d.notes || null })
    .eq("id", d.id);
  if (error) return { error: error.message };

  await db.from("audit_logs").insert({
    agency_id: d.id,
    platform_actor_id: admin.user_id,
    entity_type: "agency",
    entity_id: d.id,
    action: "tenant_updated",
    before,
    after: { name: d.name, plan: d.plan, max_guards: d.max_guards },
  });
  revalidatePath(`/platform/tenants/${d.id}`);
  revalidatePath("/platform");
  return { ok: true };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["trial", "active", "suspended", "churned"]),
  reason: z.string().trim().optional(),
});

/** Suspending locks every member out on their next request; nothing is deleted. */
export async function setTenantStatus(_prev: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const { admin, db } = await requirePlatformAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { id, status, reason } = parsed.data;
  if ((status === "suspended" || status === "churned") && (reason ?? "").length < 5) {
    return { error: "Give a reason. The tenant's owner will see it on their lock-out screen." };
  }

  const { data: before } = await db.from("agencies").select("status").eq("id", id).single();
  const suspending = status === "suspended" || status === "churned";
  const { error } = await db
    .from("agencies")
    .update({
      status,
      suspended_at: suspending ? new Date().toISOString() : null,
      suspended_reason: suspending ? reason : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await db.from("audit_logs").insert({
    agency_id: id,
    platform_actor_id: admin.user_id,
    entity_type: "agency",
    entity_id: id,
    action: `tenant_${status}`,
    reason: reason || null,
    before,
    after: { status },
  });
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform");
  return { ok: true };
}

/** Owners lock themselves out too. Issue a new one-time password for a given profile. */
export async function resetMemberPassword(_prev: PlatformActionState, formData: FormData): Promise<PlatformActionState> {
  const { admin, db } = await requirePlatformAdmin();
  const profileId = String(formData.get("profile_id") ?? "");
  const agencyId = String(formData.get("agency_id") ?? "");
  const { data: profile } = await db.from("profiles").select("email,agency_id").eq("id", profileId).maybeSingle();
  if (!profile || profile.agency_id !== agencyId) return { error: "That login is not part of this tenant." };

  const password = generatePassword();
  const { error } = await db.auth.admin.updateUserById(profileId, { password });
  if (error) return { error: error.message };

  await db.from("audit_logs").insert({
    agency_id: agencyId,
    platform_actor_id: admin.user_id,
    entity_type: "profile",
    entity_id: profileId,
    action: "password_reset_by_platform",
  });
  return { ok: true, password, email: profile.email ?? undefined };
}
