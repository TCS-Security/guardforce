"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/supabase/types";

export type LeaveActionState = { error?: string; ok?: boolean } | undefined;

function friendly(error: { message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.message.includes("LEAVE_ALREADY_DECIDED")) return "This request was already decided.";
  if (error.message.includes("LEAVE_NOT_FOUND")) return "This leave request no longer exists.";
  if (error.message.includes("FORBIDDEN")) return "You don't have permission to decide leave.";
  return "Something went wrong. Try again.";
}

function revalidateLeave() {
  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  revalidatePath("/");
}

/* --- Approve / decline (decide_leave RPC — LEAVE-1) ----------------------- */

const decisionSchema = z
  .object({
    leaveId: z.string().uuid(),
    decision: z.enum(["approve", "decline"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === "approve" || (v.note ?? "").length > 0, {
    message: "A short note is required when declining.",
  });

export async function decideLeave(_prev: LeaveActionState, formData: FormData): Promise<LeaveActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only managers can decide leave requests." };

  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { leaveId, decision, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_leave", {
    p_leave_id: leaveId,
    p_approve: decision === "approve",
    p_note: note?.length ? note : null,
  });
  if (error) return { error: friendly(error) };

  revalidateLeave();
  return { ok: true };
}

/* --- Log leave on behalf of a guard (WhatsApp requests) ------------------- */

const logSchema = z
  .object({
    guardId: z.string().uuid("Choose a guard."),
    type: z.enum(["casual", "earned", "unpaid"] satisfies [LeaveType, ...LeaveType[]]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
    reason: z.string().trim().min(3, "Add the reason the guard gave.").max(500),
    approveNow: z.enum(["0", "1"]),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "The end date can't be before the start date." });

export async function logLeave(_prev: LeaveActionState, formData: FormData): Promise<LeaveActionState> {
  const session = await requireSession();
  if (!session.isManager) return { error: "Only managers can log leave for a guard." };

  const parsed = logSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { guardId, type, startDate, endDate, reason, approveNow } = parsed.data;

  const supabase = await createClient();
  const { data: guard } = await supabase
    .from("guards")
    .select("id,site_id")
    .eq("id", guardId)
    .single();
  if (!guard) return { error: "That guard isn't in your scope." };

  const { data: inserted, error: insertError } = await supabase
    .from("leave_requests")
    .insert({
      agency_id: session.agency.id,
      guard_id: guardId,
      site_id: guard.site_id,
      type,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !inserted) return { error: friendly(insertError) ?? "Could not save the request." };

  if (approveNow === "1") {
    const { error } = await supabase.rpc("decide_leave", {
      p_leave_id: inserted.id,
      p_approve: true,
      p_note: null,
    });
    if (error) {
      revalidateLeave();
      return { error: friendly(error) };
    }
  }

  revalidateLeave();
  return { ok: true };
}

/* --- Balance totals (owner edits; creates the row when missing) ----------- */

const balanceSchema = z.object({
  guardId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  casualTotal: z.coerce.number().int().min(0).max(365),
  earnedTotal: z.coerce.number().int().min(0).max(365),
});

export async function saveBalance(_prev: LeaveActionState, formData: FormData): Promise<LeaveActionState> {
  const session = await requireSession();
  if (!session.isOwner) return { error: "Only owners can edit leave totals." };

  const parsed = balanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { guardId, year, casualTotal, earnedTotal } = parsed.data;

  const supabase = await createClient();
  const { data: guard } = await supabase.from("guards").select("id").eq("id", guardId).single();
  if (!guard) return { error: "That guard isn't in your scope." };

  const { error } = await supabase.from("leave_balances").upsert(
    {
      guard_id: guardId,
      agency_id: session.agency.id,
      year,
      casual_total: casualTotal,
      earned_total: earnedTotal,
    },
    { onConflict: "guard_id,year" },
  );
  if (error) return { error: friendly(error) };

  revalidatePath("/leave");
  return { ok: true };
}
