import { supabase } from "./supabase";
import { toApiError } from "./errors";
import type { GuardListItem, GuardRecord, LeaveInboxItem, RosterAssignment, ShiftType, SiteShift, StaffMe, SupervisorHome } from "./staffTypes";

/**
 * Supervisor-mode contract. Every write is an RPC (audited, permission-checked in SQL);
 * reads are RPC bundles so a budget phone makes one round trip per screen.
 */
async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw toApiError(error);
  return data as T;
}

export const staffApi = {
  me: () => rpc<StaffMe>("staff_me"),
  home: (date?: string) => rpc<SupervisorHome>("supervisor_home", { p_date: date ?? null }),
  siteShifts: (siteId: string, date: string) => rpc<SiteShift[]>("site_shifts", { p_site_id: siteId, p_date: date }),
  guardRecord: (guardId: string) => rpc<GuardRecord>("guard_record", { p_guard_id: guardId }),
  guards: (siteId?: string | null) => rpc<GuardListItem[]>("staff_guards", { p_site_id: siteId ?? null }),
  leaveInbox: () => rpc<LeaveInboxItem[]>("leave_inbox"),
  roster: (date: string, siteId?: string | null) => rpc<RosterAssignment[]>("roster_day", { p_date: date, p_site_id: siteId ?? null }),

  acknowledgeEvent: (eventId: string) => rpc<void>("acknowledge_event", { p_event_id: eventId }),
  logShiftException: (shiftId: string, reason: string, category: string) => rpc<unknown>("log_shift_exception", { p_shift_id: shiftId, p_reason: reason, p_category: category }),
  overrideAttendance: (shiftId: string, attendance: string, reason: string) => rpc<unknown>("override_attendance", { p_shift_id: shiftId, p_attendance: attendance, p_reason: reason }),
  decideLeave: (leaveId: string, approve: boolean, note: string | null) => rpc<unknown>("decide_leave", { p_leave_id: leaveId, p_approve: approve, p_note: note }),
  assignShift: (guardId: string, siteId: string, shiftTypeId: string, date: string) => rpc<string>("assign_shift", { p_guard_id: guardId, p_site_id: siteId, p_shift_type_id: shiftTypeId, p_date: date }),
  createTask: (p: { siteId: string; title: string; description: string | null; dueAt: string | null; photoRequired: boolean; guardIds: string[] }) =>
    rpc<string>("create_task", { p_site_id: p.siteId, p_title: p.title, p_description: p.description, p_due_at: p.dueAt, p_photo_required: p.photoRequired, p_guard_ids: p.guardIds }),
  addGuard: (p: { fullName: string; phone: string; designation: string | null; siteId: string | null }) =>
    rpc<string>("add_guard", { p_full_name: p.fullName, p_phone: p.phone, p_designation: p.designation, p_site_id: p.siteId }),
  recordDocument: (p: { guardId: string; type: string; filePath: string; mimeType: string; numberMasked: string | null }) =>
    rpc<string>("record_document", { p_guard_id: p.guardId, p_type: p.type, p_file_path: p.filePath, p_mime_type: p.mimeType, p_number_masked: p.numberMasked }),
  setGuardRegistrationSelfie: (guardId: string, path: string) => rpc<void>("set_guard_registration_selfie", { p_guard_id: guardId, p_path: path }),
  logDocumentAccess: (documentId: string, purpose: string) => rpc<void>("log_document_access", { p_document_id: documentId, p_purpose: purpose }),

  async shiftTypes(siteId: string) {
    const { data, error } = await supabase.from("shift_types").select("id,site_id,name,start_time,end_time,guards_required").eq("site_id", siteId).order("start_time");
    if (error) throw toApiError(error); return data as ShiftType[];
  },
  /** Uploads a local file (file:// URI) with upsert so retries are safe. */
  async upload(bucket: string, path: string, fileUri: string, contentType = "image/jpeg") {
    const FileSystem = await import("expo-file-system/legacy");
    const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const bin = globalThis.atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
    if (error) throw toApiError(error);
  },
  async signedUrl(bucket: string, path: string, expiresSec = 600) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    if (error) throw toApiError(error); return data.signedUrl;
  },
};
