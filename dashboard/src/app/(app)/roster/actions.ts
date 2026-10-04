"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deny, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canUnassign, rangeLabel, rangeSpanDays, rosterErrorMessage } from "@/lib/domain/roster";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const assignSchema = z.object({
  site_id: z.string().uuid(),
  guard_id: z.string().uuid(),
  shift_type_id: z.string().uuid(),
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repeat: z.string().optional(),
  weekdays: z.string().optional(),
  ends_on: z.string().optional(),
});

export async function assignShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "roster:write");
  if (denied) return denied;
  const parsed = assignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const supabase = await createClient();
  const { data: shiftType } = await supabase
    .from("shift_types")
    .select("start_time,end_time")
    .eq("id", parsed.data.shift_type_id)
    .single();
  if (!shiftType) return { error: "That shift no longer exists." };

  if (parsed.data.repeat === "weekly") {
    const weekdays = (parsed.data.weekdays ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    if (weekdays.length === 0) return { error: "Pick at least one day of the week." };
    const { error } = await supabase.from("roster_patterns").insert({
      agency_id: session.agency.id,
      site_id: parsed.data.site_id,
      guard_id: parsed.data.guard_id,
      shift_type_id: parsed.data.shift_type_id,
      weekdays,
      starts_on: parsed.data.shift_date,
      ends_on: parsed.data.ends_on || null,
      created_by: session.userId,
    });
    if (error) return { error: rosterErrorMessage(error.message) };

    const to = new Date(parsed.data.shift_date);
    to.setDate(to.getDate() + 14);
    await supabase.rpc("materialize_roster", {
      p_agency_id: session.agency.id,
      p_from: parsed.data.shift_date,
      p_to: to.toISOString().slice(0, 10),
    });
  } else {
    const { data: win } = await supabase.rpc("shift_window", {
      p_date: parsed.data.shift_date,
      p_start: shiftType.start_time,
      p_end: shiftType.end_time,
      p_tz: session.agency.timezone,
    });
    const row = Array.isArray(win) ? win[0] : win;
    const { error } = await supabase.from("shift_assignments").insert({
      agency_id: session.agency.id,
      site_id: parsed.data.site_id,
      guard_id: parsed.data.guard_id,
      shift_type_id: parsed.data.shift_type_id,
      shift_date: parsed.data.shift_date,
      scheduled_start: row!.starts_at,
      scheduled_end: row!.ends_at,
      created_by: session.userId,
    });
    if (error) return { error: rosterErrorMessage(error.message) };
  }

  revalidatePath("/roster");
  revalidatePath("/attendance");
  return { ok: true };
}

export async function unassignShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "roster:write");
  if (denied) return denied;
  const shiftId = String(formData.get("shift_id") ?? "");
  const supabase = await createClient();

  const { data: shift } = await supabase.from("shifts").select("id,status,started_at,assignment_id").eq("id", shiftId).maybeSingle();
  if (!shift) return { error: "That shift is already gone." };
  if (!canUnassign(shift)) return { error: "This shift has already started — correct the attendance instead of removing it." };

  if (shift.assignment_id) await supabase.from("shift_assignments").delete().eq("id", shift.assignment_id);
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) return { error: error.message };

  revalidatePath("/roster");
  return { ok: true };
}

export async function endPattern(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.can("roster:write")) return;
  const id = String(formData.get("pattern_id") ?? "");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  await supabase.from("roster_patterns").update({ ends_on: today }).eq("id", id);
  // Shifts this pattern would have produced later are no longer expected.
  const { data: future } = await supabase.from("shift_assignments").select("id").eq("pattern_id", id).gt("shift_date", today);
  const ids = (future ?? []).map((a) => a.id);
  if (ids.length > 0) {
    await supabase.from("shifts").delete().in("assignment_id", ids).eq("status", "scheduled");
    await supabase.from("shift_assignments").delete().in("id", ids);
  }
  revalidatePath("/roster");
}

const fillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type FillState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * "Fill from patterns": materialises the shifts the weekly patterns imply across the
 * range that is on screen — a week in the week view, the whole visible grid in the
 * month view. Reports the range it covered so the toolbar can say what it just did.
 */
export async function materializeWeek(_prev: FillState, formData: FormData): Promise<FillState> {
  const session = await requireSession();
  const denied = deny(session, "roster:write");
  if (denied) return denied;
  const parsed = fillSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Pick a valid date range to fill." };

  const { from, to } = parsed.data;
  const span = rangeSpanDays(from, to);
  if (span < 1) return { error: "That range ends before it starts." };
  if (span > 62) return { error: "Fill at most two months at a time." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("materialize_roster", {
    p_agency_id: session.agency.id,
    p_from: from,
    p_to: to,
  });
  if (error) return { error: rosterErrorMessage(error.message) };

  const created = typeof data === "number" ? data : 0;
  revalidatePath("/roster");
  revalidatePath("/attendance");
  return {
    ok: true,
    message:
      created === 0
        ? `Nothing to add — ${rangeLabel(from, to)} already matches the patterns.`
        : `Filled ${rangeLabel(from, to)} — ${created} shift${created === 1 ? "" : "s"} created.`,
  };
}
