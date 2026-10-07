import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { toApiError } from "./errors";
import type { CheckInResult, CheckOutResult, Home, LeaveBalance, LeaveRequest, Me, NotificationItem, PatrolInfo, PatrolPhoto, Ping, ShiftRecord } from "./types";

/**
 * The contract between the app and the backend: RPCs for every write, plain selects under RLS
 * for reads. Moving off Supabase later means re-implementing this file, nothing else.
 */
async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw toApiError(error);
  return data as T;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const guardApi = {
  me: () => rpc<Me>("guard_me"),
  home: () => rpc<Home>("guard_home"),
  claimAccount: () => rpc<Me>("claim_guard_account"),
  setPin: (pin: string) => rpc<void>("set_guard_pin", { p_pin: pin }),
  verifyPin: (pin: string) => rpc<boolean>("verify_guard_pin", { p_pin: pin }),
  setRegistrationSelfie: (path: string) => rpc<void>("set_registration_selfie", { p_path: path }),
  registerDevice: (p: { installId: string; fcmToken?: string | null; model: string; osVersion: string; appVersion: string; bundleVersion: string }) =>
    rpc<string>("register_device", { p_install_id: p.installId, p_fcm_token: p.fcmToken ?? null, p_model: p.model, p_os_version: p.osVersion, p_app_version: p.appVersion, p_bundle_version: p.bundleVersion }),

  /** Uploads a local file (file:// URI) with upsert so outbox retries are safe. */
  async upload(bucket: string, path: string, fileUri: string, contentType = "image/jpeg") {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return; // media pruned; the RPC still records the path
    const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const { error } = await supabase.storage.from(bucket).upload(path, base64ToBytes(b64), { contentType, upsert: true });
    if (error) throw toApiError(error);
  },
  async signedUrl(bucket: string, path: string, expiresSec = 600) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    if (error) throw toApiError(error);
    return data.signedUrl;
  },

  checkIn: (p: { guardId: string; siteId: string; lat: number; lng: number; accuracyM: number | null; selfiePath: string; capturedAt: string; device: Record<string, unknown>; shiftId: string | null }) =>
    rpc<CheckInResult>("check_in", { p_guard_id: p.guardId, p_site_id: p.siteId, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: p.accuracyM, p_selfie_path: p.selfiePath, p_captured_at: p.capturedAt, p_device: p.device, p_shift_id: p.shiftId }),
  checkOut: (p: { shiftId: string; lat: number; lng: number; accuracyM: number | null; selfiePath: string; capturedAt: string; device: Record<string, unknown> }) =>
    rpc<CheckOutResult>("check_out", { p_shift_id: p.shiftId, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: p.accuracyM, p_selfie_path: p.selfiePath, p_captured_at: p.capturedAt, p_device: p.device }),
  ingestPings: (shiftId: string, pings: Ping[]) => rpc<number>("ingest_pings", { p_shift_id: shiftId, p_pings: pings }),
  reportLocationState: (shiftId: string, enabled: boolean, at: string) => rpc<void>("report_location_state", { p_shift_id: shiftId, p_enabled: enabled, p_at: at }),
  reportTamper: (guardId: string, siteId: string, lat: number | null, lng: number | null, detail: string | null) =>
    rpc<string>("report_tamper", { p_guard_id: guardId, p_site_id: siteId, p_lat: lat, p_lng: lng, p_detail: detail }),

  startPatrol: (patrolId: string, at: string) => rpc<PatrolInfo>("start_patrol", { p_patrol_id: patrolId, p_at: at }),
  completePatrol: (patrolId: string, trail: [number, number][], photos: PatrolPhoto[], at: string, notes: string | null) =>
    rpc<PatrolInfo>("complete_patrol", { p_patrol_id: patrolId, p_trail: trail.length >= 2 ? { type: "LineString", coordinates: trail } : null, p_photos: photos, p_at: at, p_notes: notes }),
  startTask: (taskId: string, at: string) => rpc<void>("start_task", { p_task_id: taskId, p_at: at }),
  completeTask: (p: { taskId: string; photoPath: string | null; note: string | null; lat: number | null; lng: number | null; at: string }) =>
    rpc<void>("complete_task", { p_task_id: p.taskId, p_photo_path: p.photoPath, p_note: p.note, p_lat: p.lat, p_lng: p.lng, p_at: p.at }),
  applyLeave: (type: string, start: string, end: string, reason: string | null) => rpc<LeaveRequest>("apply_leave", { p_type: type, p_start: start, p_end: end, p_reason: reason }),
  cancelLeave: (id: string) => rpc<LeaveRequest>("cancel_leave", { p_leave_id: id }),

  async listLeave(guardId: string) {
    const { data, error } = await supabase.from("leave_requests").select("id,type,start_date,end_date,reason,status,decided_at,decision_note,created_at").eq("guard_id", guardId).order("start_date", { ascending: false }).limit(50);
    if (error) throw toApiError(error); return data as LeaveRequest[];
  },
  async leaveBalance(guardId: string, year: number) {
    const { data, error } = await supabase.from("leave_balances").select("year,casual_total,earned_total,casual_used,earned_used,unpaid_used").eq("guard_id", guardId).eq("year", year).maybeSingle();
    if (error) throw toApiError(error); return data as LeaveBalance | null;
  },
  async listShifts(guardId: string, fromDate: string, toDate: string) {
    const { data, error } = await supabase.from("shifts").select("id,site_id,shift_date,scheduled_start,scheduled_end,status,attendance,started_at,ended_at,flags,trust,late_by_min,worked_minutes,away_seconds,sites(name)")
      .eq("guard_id", guardId).gte("shift_date", fromDate).lte("shift_date", toDate).order("shift_date", { ascending: false }).order("scheduled_start", { ascending: false }).limit(100);
    if (error) throw toApiError(error); return data as unknown as ShiftRecord[];
  },
  async listNotifications(guardId: string) {
    const { data, error } = await supabase.from("notifications").select("id,title,body,created_at,read_at,payload").eq("recipient_guard_id", guardId).order("created_at", { ascending: false }).limit(50);
    if (error) throw toApiError(error); return data as NotificationItem[];
  },
  async markNotificationsRead(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) throw toApiError(error);
  },
};
