"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deny, requireSession } from "@/lib/auth/session";
import { validatePolygonRing, type LngLat } from "@/lib/domain/sites";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const coord = z.coerce.number().refine((n) => Number.isFinite(n), "Invalid coordinate");

const siteSchema = z.object({
  name: z.string().trim().min(2, "Site name is required"),
  client_name: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  lat: coord.refine((n) => n >= -90 && n <= 90, "Latitude out of range"),
  lng: coord.refine((n) => n >= -180 && n <= 180, "Longitude out of range"),
  fence_type: z.enum(["radius", "polygon"]),
  radius_m: z.coerce.number().int().min(100, "Radius is at least 100 m").max(1000, "Radius is at most 1000 m"),
  leeway_m: z.coerce.number().int().min(0).max(300, "Leeway is at most 300 m"),
  guards_required: z.coerce.number().int().min(1, "At least one guard").max(100),
  patrol_photo_required: z.coerce.boolean().optional(),
  notes: z.string().trim().optional(),
  polygon: z.string().optional(),
});

function parsePolygon(raw: string | undefined, fenceType: string) {
  if (fenceType !== "polygon") return { polygon: null as unknown, error: undefined };
  if (!raw) return { polygon: null, error: "Draw the site perimeter on the map, or switch to a radius fence." };
  let ring: LngLat[];
  try {
    ring = JSON.parse(raw) as LngLat[];
  } catch {
    return { polygon: null, error: "The drawn perimeter could not be read. Redraw it." };
  }
  const checked = validatePolygonRing(ring);
  if (!checked.ok) return { polygon: null, error: checked.error };
  return { polygon: checked.polygon, error: undefined };
}

function formValues(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.patrol_photo_required = formData.get("patrol_photo_required") === "on" || formData.get("patrol_photo_required") === "true";
  return raw;
}

export async function createSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sites:write");
  if (denied) return denied;
  const parsed = siteSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { polygon, error } = parsePolygon(parsed.data.polygon, parsed.data.fence_type);
  if (error) return { error };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("sites")
    .insert({
      agency_id: session.agency.id,
      name: parsed.data.name,
      client_name: parsed.data.client_name || null,
      address: parsed.data.address || null,
      city: parsed.data.city || session.agency.city,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      fence_type: parsed.data.fence_type,
      radius_m: parsed.data.radius_m,
      leeway_m: parsed.data.leeway_m,
      polygon: polygon as never,
      guards_required: parsed.data.guards_required,
      patrol_photo_required: !!parsed.data.patrol_photo_required,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (dbError) return { error: dbError.message };

  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "site",
    entity_id: data.id,
    action: "site_created",
    after: { name: parsed.data.name, fence_type: parsed.data.fence_type },
  });

  revalidatePath("/sites");
  redirect(`/sites/${data.id}`);
}

export async function updateSite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sites:write");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing site" };
  const parsed = siteSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { polygon, error } = parsePolygon(parsed.data.polygon, parsed.data.fence_type);
  if (error) return { error };

  const supabase = await createClient();
  const { data: before } = await supabase.from("sites").select("*").eq("id", id).single();
  const { error: dbError } = await supabase
    .from("sites")
    .update({
      name: parsed.data.name,
      client_name: parsed.data.client_name || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      fence_type: parsed.data.fence_type,
      radius_m: parsed.data.radius_m,
      leeway_m: parsed.data.leeway_m,
      polygon: polygon as never,
      guards_required: parsed.data.guards_required,
      patrol_photo_required: !!parsed.data.patrol_photo_required,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (dbError) return { error: dbError.message };

  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "site",
    entity_id: id,
    action: "site_updated",
    before: before ? { fence_type: before.fence_type, radius_m: before.radius_m, leeway_m: before.leeway_m, guards_required: before.guards_required } : null,
    after: { fence_type: parsed.data.fence_type, radius_m: parsed.data.radius_m, leeway_m: parsed.data.leeway_m, guards_required: parsed.data.guards_required },
  });

  revalidatePath(`/sites/${id}`);
  revalidatePath("/sites");
  return { ok: true };
}

export async function setSiteActive(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.can("sites:write")) return;
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("sites").update({ is_active: active }).eq("id", id);
  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.userId,
    entity_type: "site",
    entity_id: id,
    action: active ? "site_reactivated" : "site_deactivated",
  });
  revalidatePath(`/sites/${id}`);
  revalidatePath("/sites");
}

// ---------------------------------------------------------------------------
// Shift types
// ---------------------------------------------------------------------------
const shiftTypeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  site_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name the shift"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Start time looks wrong"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "End time looks wrong"),
  guards_required: z.coerce.number().int().min(1).max(100),
});

export async function saveShiftType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sites:write");
  if (denied) return denied;
  const parsed = shiftTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  if (parsed.data.start_time === parsed.data.end_time) return { error: "Start and end time cannot be the same." };

  const supabase = await createClient();
  const payload = {
    agency_id: session.agency.id,
    site_id: parsed.data.site_id,
    name: parsed.data.name,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    guards_required: parsed.data.guards_required,
  };
  const { error } = parsed.data.id
    ? await supabase.from("shift_types").update(payload).eq("id", parsed.data.id)
    : await supabase.from("shift_types").insert(payload);
  if (error) return { error: error.message };
  revalidatePath(`/sites/${parsed.data.site_id}`);
  return { ok: true };
}

export async function deleteShiftType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sites:write");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const siteId = String(formData.get("site_id") ?? "");
  const supabase = await createClient();

  const [{ count: assignments }, { count: patterns }] = await Promise.all([
    supabase.from("shift_assignments").select("id", { count: "exact", head: true }).eq("shift_type_id", id),
    supabase.from("roster_patterns").select("id", { count: "exact", head: true }).eq("shift_type_id", id),
  ]);
  if ((assignments ?? 0) > 0 || (patterns ?? 0) > 0) {
    return { error: `This shift is used by ${(assignments ?? 0) + (patterns ?? 0)} roster entries. Remove those first, or leave it in place for the record.` };
  }
  const { error } = await supabase.from("shift_types").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Supervisor assignment
// ---------------------------------------------------------------------------
export async function assignSupervisor(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.can("team:manage")) return;
  const siteId = String(formData.get("site_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  const attach = formData.get("attach") === "true";
  const supabase = await createClient();
  if (attach) {
    await supabase.from("supervisor_sites").insert({ profile_id: profileId, site_id: siteId, agency_id: session.agency.id });
  } else {
    await supabase.from("supervisor_sites").delete().eq("profile_id", profileId).eq("site_id", siteId);
  }
  revalidatePath(`/sites/${siteId}`);
}
