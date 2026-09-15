// Contract for the supervisor mode (supabase/migrations/0012_supervisor_app.sql). Field names are SQL column names.
export type StaffMe = {
  profile: { id: string; full_name: string; email?: string | null; phone?: string | null; role: string; role_name?: string | null; all_sites: boolean };
  agency: { id: string; name: string; status: string; timezone: string; late_threshold_min: number };
  permissions: string[];
  sites: StaffSite[];
  server_time?: string;
};
export type StaffSite = { id: string; name: string; client_name?: string | null; address?: string | null; lat: number; lng: number; guards_required: number; patrol_photo_required: boolean };

export type SiteSummary = { id: string; name: string; guards_required: number; scheduled: number; present: number; half_day: number; absent: number; on_leave: number; on_duty_now: number; late: number; flagged: number; pending: number };
export type OnDutyGuard = { guard_id: string; guard_name: string; guard_phone?: string | null; site_id: string; shift_id: string | null; lat?: number | null; lng?: number | null; in_fence?: boolean | null; battery_pct?: number | null; location_enabled: boolean; last_seen_at?: string | null; started_at?: string | null; flags: string[] };
export type AlertItem = { id: string; type: string; severity: string; title: string; site_id?: string | null; site_name?: string | null; guard_id?: string | null; guard_name?: string | null; guard_phone?: string | null; shift_id?: string | null; shift_date?: string | null; payload: Record<string, unknown>; created_at: string };
export type SupervisorHome = { date: string; server_time?: string; sites: SiteSummary[]; on_duty: OnDutyGuard[]; alerts: AlertItem[]; pending_leave: number; missed_patrols_today: number };

export type SiteShift = {
  id: string; guard_id: string; guard_name: string; guard_phone?: string | null; employee_code?: string | null; shift_type?: string | null;
  scheduled_start?: string | null; scheduled_end?: string | null; started_at?: string | null; start_captured_at?: string | null; ended_at?: string | null;
  status: string; attendance: string; trust?: string | null; flags: string[]; late_by_min: number; worked_minutes: number; away_seconds: number;
  location_enabled: boolean; location_off_seconds: number; start_in_fence?: boolean | null; start_distance_m?: number | null; end_in_fence?: boolean | null;
  start_selfie_path?: string | null; end_selfie_path?: string | null; exception_reason?: string | null; override_reason?: string | null;
  in_fence_now?: boolean | null; last_seen_at?: string | null; battery_pct?: number | null;
};

export type GuardRecord = {
  guard: { id: string; full_name: string; phone: string; employee_code?: string | null; designation?: string | null; site_id?: string | null; site_name?: string | null; status: string; registration_selfie_path?: string | null; joined_at?: string | null; phone_verified_at?: string | null; profile_id?: string | null };
  kyc_missing: string[];
  documents: { id: string; type: string; status: string; file_path?: string | null; number_masked?: string | null; rejection_reason?: string | null }[];
  shifts: { id: string; shift_date: string; site_name?: string | null; status: string; attendance: string; started_at?: string | null; ended_at?: string | null; flags: string[]; worked_minutes: number; away_seconds: number; late_by_min: number }[];
  supervisor?: { name: string; phone?: string | null } | null;
};

export type GuardListItem = { id: string; full_name: string; phone: string; employee_code?: string | null; designation?: string | null; site_id?: string | null; site_name?: string | null; status: string; kyc_complete: boolean; on_duty: boolean };
export type ShiftType = { id: string; site_id: string; name: string; start_time: string; end_time: string; guards_required: number };
export type RosterAssignment = { id: string; site_id: string; site_name?: string | null; guard_id: string; guard_name: string; shift_type_id: string; shift_type?: string | null; shift_date: string; scheduled_start: string; scheduled_end: string; shift_status?: string | null; attendance?: string | null };
export type LeaveInboxItem = { id: string; guard_id: string; guard_name: string; site_id?: string | null; site_name?: string | null; type: string; start_date: string; end_date: string; reason?: string | null; status: string; created_at: string; casual_left?: number | null; earned_left?: number | null };
