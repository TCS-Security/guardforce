import { ApiError } from "../api/errors";
import { t, type StringKey } from "../i18n";
import type { Tone } from "./theme";

/** Status → label/tone, mirroring dashboard/src/lib/domain/status.ts. */
export const attendance = (a: string): [string, Tone] =>
  a === "present" ? [t("attendance_present"), "present"] : a === "half_day" ? [t("attendance_half_day"), "halfDay"] : a === "absent" ? [t("attendance_absent"), "absent"] : a === "on_leave" ? [t("attendance_on_leave"), "onLeave"] : [t("attendance_pending"), "neutral"];
const flagKeys: Record<string, StringKey> = { OUTSIDE_FENCE: "flag_outside_fence", LATE_START: "flag_late_start", EARLY_CHECKOUT: "flag_early_checkout", LOCATION_OFF: "flag_location_off", TAMPER_SUSPECTED: "flag_tamper", SYNCED_LATE: "flag_synced_late", LOW_ACCURACY: "flag_low_accuracy" };
export const flag = (f: string) => (flagKeys[f] ? t(flagKeys[f]) : f);
export const flagTone = (f: string): Tone => (f === "LOCATION_OFF" || f === "TAMPER_SUSPECTED" ? "absent" : "halfDay");
export const patrol = (s: string): [string, Tone] =>
  s === "in_progress" ? [t("patrol_status_in_progress"), "olive"] : s === "completed" ? [t("patrol_status_completed"), "present"] : s === "late" ? [t("patrol_status_late"), "halfDay"] : s === "missed" ? [t("patrol_status_missed"), "absent"] : [t("patrol_status_scheduled"), "neutral"];
export const leave = (s: string): [string, Tone] =>
  s === "approved" ? [t("leave_status_approved"), "present"] : s === "declined" ? [t("leave_status_declined"), "absent"] : s === "cancelled" ? [t("leave_status_cancelled"), "neutral"] : [t("leave_status_pending"), "halfDay"];
export const leaveType = (ty: string) => (ty === "earned" ? t("leave_earned") : ty === "unpaid" ? t("leave_unpaid") : t("leave_casual"));
const docKeys: Record<string, StringKey> = { aadhaar: "doc_aadhaar", pan: "doc_pan", police_verification: "doc_police_verification", marksheet: "doc_marksheet", guard_kyc: "doc_guard_kyc" };
export const docType = (d: string) => t(docKeys[d] ?? "doc_other");
export const docStatus = (s: string | null | undefined): [string, Tone] =>
  s === "verified" ? [t("doc_verified"), "present"] : s === "rejected" ? [t("doc_rejected"), "absent"] : s === "pending" ? [t("doc_pending"), "halfDay"] : [t("doc_missing"), "neutral"];
export const kycGap = (g: string) => (g === "phone_verification" ? t("gap_phone_verification") : g === "registration_selfie" ? t("gap_registration_selfie") : g === "designation" ? t("gap_designation") : docType(g));
export const relative = (r: { unit: "now" | "min" | "hr"; n: number }) => (r.unit === "now" ? t("time_now") : r.unit === "min" ? t("time_min_ago", r.n) : t("time_hr_ago", r.n));
export const duration = (seconds: number) => { const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60); return h > 0 ? t("duration_hm", h, String(m).padStart(2, "0")) : t("duration_m", m); };

export function errorText(e: unknown): string {
  const err = e instanceof ApiError ? e : null;
  const code = err?.code ?? "";
  switch (code) {
    case "NETWORK": case "SERVER": return t("error_network");
    case "UNAUTHORIZED": return t("error_session");
    case "NO_GUARD_FOR_PHONE": return t("claim_not_found");
    case "PHONE_ALREADY_LINKED": return t("claim_already_linked");
    case "TAMPER_SUSPECTED": return t("checkin_mock");
    case "LEAVE_OVERLAP": return t("leave_overlap");
    case "LEAVE_DATES_INVALID": return t("leave_dates_invalid");
    case "PATROL_PHOTO_REQUIRED": return t("patrol_photo_required", 1);
    case "TASK_PHOTO_REQUIRED": return t("task_photo_required");
  }
  const msg = (e as Error)?.message ?? String(e);
  if (/otp|token/i.test(msg)) return t("otp_invalid");
  return t("error_generic", (code || msg).slice(0, 80));
}
