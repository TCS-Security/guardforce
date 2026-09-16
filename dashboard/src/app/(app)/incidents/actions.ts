"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deny, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fromLocalInput } from "@/lib/domain/format";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_TYPES } from "@/lib/domain/incidents";
import type { IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/supabase/types";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const optionalId = z.string().uuid().optional().or(z.literal("")).or(z.literal("none"));

const incidentSchema = z.object({
  site_id: z.string().uuid("Pick the site where it happened"),
  type: z.enum(INCIDENT_TYPES as [IncidentType, ...IncidentType[]]),
  severity: z.enum(INCIDENT_SEVERITIES as [IncidentSeverity, ...IncidentSeverity[]]),
  title: z.string().trim().min(3, "Give the incident a short title"),
  description: z.string().trim().min(10, "Describe what happened — at least a sentence"),
  occurred_at: z.string().min(1, "When did it happen?"),
  guard_id: optionalId,
  lat: z.string().optional(),
  lng: z.string().optional(),
});

/** Optional coordinates: either both or neither, and inside the real world. */
function parsePoint(lat: string | undefined, lng: string | undefined) {
  const a = lat?.trim() ? Number(lat) : null;
  const b = lng?.trim() ? Number(lng) : null;
  if (a == null && b == null) return { ok: true as const, lat: null, lng: null };
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) {
    return { ok: false as const, message: "Give both a latitude and a longitude, or neither." };
  }
  if (a < -90 || a > 90 || b < -180 || b > 180) {
    return { ok: false as const, message: "That latitude/longitude is not a real place." };
  }
  return { ok: true as const, lat: a, lng: b };
}

export async function logIncident(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "incidents:write");
  if (denied) return denied;

  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const point = parsePoint(parsed.data.lat, parsed.data.lng);
  if (!point.ok) return { error: point.message };

  const occurred = fromLocalInput(parsed.data.occurred_at, session.agency.timezone);
  if (Number.isNaN(occurred.getTime())) return { error: "That is not a valid date and time." };
  if (occurred.getTime() > Date.now() + 60_000) return { error: "An incident cannot have happened in the future." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      agency_id: session.agency.id,
      site_id: parsed.data.site_id,
      type: parsed.data.type,
      severity: parsed.data.severity,
      title: parsed.data.title,
      description: parsed.data.description,
      occurred_at: occurred.toISOString(),
      reported_by: session.userId,
      guard_id: parsed.data.guard_id && parsed.data.guard_id !== "none" ? parsed.data.guard_id : null,
      lat: point.lat,
      lng: point.lng,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/incidents");
  redirect(`/incidents/${data.id}`);
}

const statusSchema = z.object({
  incident_id: z.string().uuid(),
  status: z.enum(INCIDENT_STATUSES as [IncidentStatus, ...IncidentStatus[]]),
  resolution: z.string().trim().optional(),
});

/** Life cycle: take it up (investigating), close it (resolved) or re-open it. */
export async function setIncidentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "incidents:write");
  if (denied) return denied;

  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { incident_id, status } = parsed.data;
  const resolution = parsed.data.resolution || null;
  if (status === "resolved" && (resolution?.length ?? 0) < 10) {
    return { error: "Say how it was resolved — that note is what the client is shown." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .update({
      status,
      // Re-opening keeps the history readable by clearing the old closing note; the
      // resolved_at/resolved_by pair is maintained by a trigger.
      resolution: status === "resolved" ? resolution : null,
    })
    .eq("id", incident_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That incident is not yours to change." };

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${incident_id}`);
  return { ok: true };
}
