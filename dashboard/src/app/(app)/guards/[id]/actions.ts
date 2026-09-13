"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { normalizePhone, isValidIndianMobile, kycObjectPath, clampShareDays, shareExpiresAt } from "@/lib/domain/guards";
import { maskAadhaar, maskPan } from "@/lib/domain/kyc";
import { DOCUMENT_TYPES } from "@/lib/domain/status";
import type { DocumentType } from "@/lib/supabase/types";

type ActionResult = { error?: string } | undefined;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Za-z]{5}\d{4}[A-Za-z]$/;
const DOC_TYPES = DOCUMENT_TYPES.map((d) => d.type);

async function requireManager() {
  const session = await requireSession();
  if (!session.isManager) throw new Error("Only owners and supervisors can do this.");
  return session;
}

function revalidateGuard(guardId: string) {
  revalidatePath(`/guards/${guardId}`);
  revalidatePath("/guards");
}

// --- invites ---------------------------------------------------------------

export async function markInviteSent(inviteId: string, guardId: string): Promise<ActionResult> {
  const session = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("guard_invites").update({ sent_at: new Date().toISOString() }).eq("id", inviteId);
  if (error) return { error: error.message };
  void session;
  revalidateGuard(guardId);
}

/** New invite token (also used as "resend" for phone re-verification via a fresh app login). */
export async function resendInvite(guardId: string): Promise<ActionResult> {
  const session = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("guard_invites").insert({
    agency_id: session.agency.id,
    guard_id: guardId,
    channel: "sms",
    created_by: session.profile.id,
  });
  if (error) return { error: error.message };
  revalidateGuard(guardId);
}

// --- profile -----------------------------------------------------------

const profileSchema = z.object({
  guard_id: z.string(),
  full_name: z.string().trim().min(2, "Enter the guard's full name"),
  phone: z.string().trim().refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number"),
  designation: z.string().trim().optional(),
  site_id: z.string().optional(),
  supervisor_id: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().trim().optional(),
  languages: z.string().optional(),
  emergency_contact: z.string().trim().optional(),
});

export type UpdateProfileState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

export async function updateGuardProfile(_prev: UpdateProfileState, formData: FormData): Promise<UpdateProfileState> {
  await requireManager();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: parsed.error.issues[0]?.message ?? "Check the form for errors.", fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("guards")
    .update({
      full_name: v.full_name.trim(),
      phone: normalizePhone(v.phone),
      designation: v.designation?.trim() || null,
      site_id: v.site_id || null,
      supervisor_id: v.supervisor_id || null,
      date_of_birth: v.date_of_birth || null,
      address: v.address?.trim() || null,
      languages: v.languages ? v.languages.split(",").map((s) => s.trim()).filter(Boolean) : [],
      emergency_contact: v.emergency_contact?.trim() || null,
    })
    .eq("id", v.guard_id);
  if (error) {
    if (error.code === "23505") return { error: "Another guard already has this phone number.", fieldErrors: { phone: "Already registered" } };
    return { error: error.message };
  }
  revalidateGuard(v.guard_id);
  return undefined;
}

// --- KYC vault -----------------------------------------------------------

export type UploadDocState = { error?: string } | undefined;

export async function uploadGuardDocument(_prev: UploadDocState, formData: FormData): Promise<UploadDocState> {
  const session = await requireManager();
  const guardId = String(formData.get("guard_id") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  const number = String(formData.get("number") ?? "").trim();
  const issuedOn = String(formData.get("issued_on") ?? "").trim();
  const expiresOn = String(formData.get("expires_on") ?? "").trim();
  const file = formData.get("file");

  if (!guardId || !DOC_TYPES.includes(typeRaw as DocumentType)) return { error: "Missing guard or document type." };
  const type = typeRaw as DocumentType;
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "File is larger than 10 MB." };
  if (!ALLOWED_MIME.includes(file.type)) return { error: "Only JPEG, PNG, WebP or PDF files are accepted." };

  let numberMasked: string | null = null;
  if (type === "aadhaar" && number) {
    const digits = number.replace(/\s/g, "");
    if (!AADHAAR_RE.test(digits)) return { error: "Aadhaar number must be 12 digits." };
    numberMasked = maskAadhaar(digits);
  }
  if (type === "pan" && number) {
    if (!PAN_RE.test(number.replace(/\s/g, ""))) return { error: "PAN must look like ABCDE1234F." };
    numberMasked = maskPan(number);
  }

  const supabase = await createClient();
  const { data: guard } = await supabase.from("guards").select("employee_code").eq("id", guardId).maybeSingle();
  if (!guard) return { error: "Guard not found." };

  const { data: existing } = await supabase
    .from("guard_documents")
    .select("id,file_path")
    .eq("guard_id", guardId)
    .eq("type", type)
    .maybeSingle();

  const path = kycObjectPath(session.agency.id, guard.employee_code ?? guardId, type, file.name);
  const { error: uploadError } = await supabase.storage.from("kyc-docs").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  if (existing?.file_path) {
    await supabase.storage.from("kyc-docs").remove([existing.file_path]);
  }

  const row = {
    agency_id: session.agency.id,
    guard_id: guardId,
    type,
    file_path: path,
    mime_type: file.type,
    number_masked: numberMasked,
    issued_on: issuedOn || null,
    expires_on: expiresOn || null,
    status: "pending" as const,
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    uploaded_by: session.profile.id,
  };

  const { error } = existing
    ? await supabase.from("guard_documents").update(row).eq("id", existing.id)
    : await supabase.from("guard_documents").insert(row);
  if (error) return { error: error.message };

  revalidateGuard(guardId);
  return undefined;
}

export async function viewGuardDocument(documentId: string, guardId: string): Promise<{ url?: string; error?: string }> {
  const session = await requireManager();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("guard_documents").select("id,file_path,agency_id").eq("id", documentId).maybeSingle();
  if (!doc?.file_path) return { error: "No file uploaded for this document yet." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("kyc-docs").createSignedUrl(doc.file_path, 600);
  if (error || !data) return { error: "Could not create a signed link." };

  await supabase.from("document_access_logs").insert({
    agency_id: doc.agency_id,
    document_id: doc.id,
    accessed_by: session.profile.id,
    purpose: "view",
  });
  revalidateGuard(guardId);
  return { url: data.signedUrl };
}

export async function verifyGuardDocument(documentId: string, guardId: string): Promise<ActionResult> {
  const session = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("guard_documents")
    .update({ status: "verified", verified_by: session.profile.id, verified_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", documentId);
  if (error) return { error: error.message };
  revalidateGuard(guardId);
}

export async function rejectGuardDocument(documentId: string, guardId: string, reason: string): Promise<ActionResult> {
  const session = await requireManager();
  if (!reason.trim()) return { error: "A rejection reason is required." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("guard_documents")
    .update({ status: "rejected", rejection_reason: reason.trim(), verified_by: session.profile.id, verified_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) return { error: error.message };
  revalidateGuard(guardId);
}

export async function deleteGuardDocument(documentId: string, guardId: string): Promise<ActionResult> {
  await requireManager();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("guard_documents").select("file_path").eq("id", documentId).maybeSingle();
  if (doc?.file_path) await supabase.storage.from("kyc-docs").remove([doc.file_path]);
  const { error } = await supabase.from("guard_documents").delete().eq("id", documentId);
  if (error) return { error: error.message };
  revalidateGuard(guardId);
}

// --- shares ---------------------------------------------------------------

const shareSchema = z.object({
  guard_id: z.string(),
  label: z.string().trim().optional(),
  include_documents: z.string().optional(),
  expiry_days: z.coerce.number().optional(),
});

export type ShareState = { error?: string } | undefined;

export async function createGuardShare(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const session = await requireManager();
  const parsed = shareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form for errors." };
  const v = parsed.data;
  const days = clampShareDays(v.expiry_days);
  const supabase = await createClient();
  const { error } = await supabase.from("profile_shares").insert({
    agency_id: session.agency.id,
    guard_id: v.guard_id,
    label: v.label || null,
    include_documents: v.include_documents === "on",
    expires_at: shareExpiresAt(days).toISOString(),
    created_by: session.profile.id,
  });
  if (error) return { error: error.message };
  revalidateGuard(v.guard_id);
  return undefined;
}

export async function revokeGuardShare(shareId: string, guardId: string): Promise<ActionResult> {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("profile_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId);
  if (error) return { error: error.message };
  revalidateGuard(guardId);
}

// --- lifecycle --------------------------------------------------------

async function setGuardStatus(guardId: string, status: "active" | "inactive", action: string) {
  const session = await requireManager();
  const supabase = await createClient();
  const { data: before } = await supabase.from("guards").select("status").eq("id", guardId).maybeSingle();
  const { error } = await supabase.from("guards").update({ status }).eq("id", guardId);
  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    agency_id: session.agency.id,
    actor_id: session.profile.id,
    entity_type: "guard",
    entity_id: guardId,
    action,
    before: before ?? null,
    after: { status },
  });
  revalidateGuard(guardId);
}

export async function deactivateGuard(guardId: string): Promise<ActionResult> {
  return setGuardStatus(guardId, "inactive", "deactivate");
}

export async function reactivateGuard(guardId: string): Promise<ActionResult> {
  return setGuardStatus(guardId, "active", "reactivate");
}
