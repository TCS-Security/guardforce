import type { Guard, GuardDocument } from "@/lib/supabase/types";
import { DOCUMENT_TYPES } from "./status";

export type KycGap = "phone_verification" | "registration_selfie" | "designation" | "aadhaar" | "pan" | "police_verification" | "guard_kyc";

export const KYC_GAP_LABELS: Record<KycGap, string> = {
  phone_verification: "Phone not OTP-verified",
  registration_selfie: "Registration selfie missing",
  designation: "Post / designation missing",
  aadhaar: "Aadhaar missing",
  pan: "PAN missing",
  police_verification: "Police verification missing",
  guard_kyc: "Guard KYC form missing",
};

/** Mirror of public.guard_kyc_missing: mandatory slots that block rostering. */
export function kycGaps(
  guard: Pick<Guard, "phone_verified_at" | "registration_selfie_path" | "designation">,
  docs: Pick<GuardDocument, "type" | "status" | "file_path">[],
): KycGap[] {
  const gaps: KycGap[] = [];
  if (!guard.phone_verified_at) gaps.push("phone_verification");
  if (!guard.registration_selfie_path) gaps.push("registration_selfie");
  if (!guard.designation?.trim()) gaps.push("designation");
  for (const slot of DOCUMENT_TYPES.filter((d) => d.required)) {
    const ok = docs.some((d) => d.type === slot.type && d.status !== "rejected" && !!d.file_path);
    if (!ok) gaps.push(slot.type as KycGap);
  }
  return gaps;
}

export function kycComplete(guard: Parameters<typeof kycGaps>[0], docs: Parameters<typeof kycGaps>[1]) {
  return kycGaps(guard, docs).length === 0;
}

/** 0..100 completion for progress bars: 7 mandatory items. */
export function kycProgress(guard: Parameters<typeof kycGaps>[0], docs: Parameters<typeof kycGaps>[1]) {
  const total = 3 + DOCUMENT_TYPES.filter((d) => d.required).length;
  return Math.round((100 * (total - kycGaps(guard, docs).length)) / total);
}

export function maskAadhaar(n: string) {
  const digits = n.replace(/\D/g, "");
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "XXXX XXXX XXXX";
}

export function maskPan(n: string) {
  const s = n.toUpperCase().replace(/\s/g, "");
  return s.length === 10 ? `XXXXX${s.slice(5, 9)}X` : "XXXXXXXXXX";
}
