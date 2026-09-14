"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deny, requireSession } from "@/lib/auth/session";
import { normalizePhone, isValidIndianMobile } from "@/lib/domain/guards";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter the guard's full name"),
  phone: z.string().trim().refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number"),
  employee_code: z.string().trim().min(1, "Employee code is required"),
  designation: z.string().trim().optional(),
  site_id: z.string().optional(),
  supervisor_id: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().trim().optional(),
  languages: z.string().optional(),
  emergency_contact: z.string().trim().optional(),
});

export type CreateGuardState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/** F1/F2: add a guard to the roster and generate their invite. */
export async function createGuard(_prev: CreateGuardState, formData: FormData): Promise<CreateGuardState> {
  const session = await requireSession();
  const denied = deny(session, "guards:write");
  if (denied) return denied;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors.", fieldErrors };
  }
  const v = parsed.data;
  const phone = normalizePhone(v.phone);
  const code = v.employee_code.trim();
  const supabase = await createClient();

  const { data: existingCode } = await supabase.from("guards").select("id").eq("employee_code", code).maybeSingle();
  if (existingCode) return { error: `Employee code ${code} is already in use.`, fieldErrors: { employee_code: "Already in use" } };

  const languages = v.languages
    ? v.languages.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const { data: guard, error } = await supabase
    .from("guards")
    .insert({
      agency_id: session.agency.id,
      full_name: v.full_name.trim(),
      phone,
      employee_code: code,
      designation: v.designation?.trim() || null,
      site_id: v.site_id || null,
      supervisor_id: v.supervisor_id || null,
      date_of_birth: v.date_of_birth || null,
      address: v.address?.trim() || null,
      languages,
      emergency_contact: v.emergency_contact?.trim() || null,
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A guard with this phone number already exists.", fieldErrors: { phone: "Already registered" } };
    return { error: `Could not create guard: ${error.message}` };
  }

  const { error: inviteError } = await supabase.from("guard_invites").insert({
    agency_id: session.agency.id,
    guard_id: guard.id,
    channel: "sms",
    created_by: session.profile.id,
  });
  if (inviteError) return { error: `Guard created, but the invite could not be generated: ${inviteError.message}` };

  revalidatePath("/guards");
  redirect(`/guards/${guard.id}?new=1`);
}
