// Shapes returned by guard_me() / guard_home() (supabase/migrations/0011_guard_app.sql).
export type DocInfo = { type: string; status: string; has_file: boolean };
export type SiteInfo = {
  id: string; name: string; client_name?: string | null; address?: string | null; lat: number; lng: number;
  fence_type: "radius" | "polygon"; radius_m: number; polygon?: { type: string; coordinates: [number, number][][] } | null;
  leeway_m: number; patrol_photo_required: boolean;
};
export type AppConfig = {
  min_app_version: string; ota_channel: string; ping_interval_moving_s: number; ping_interval_stationary_s: number;
  selfie_max_kb: number; photo_max_kb: number; features: Record<string, unknown>;
};
export type Me = {
  guard: {
    id: string; agency_id: string; employee_code?: string | null; full_name: string; phone: string; designation?: string | null;
    site_id?: string | null; status: string; registration_selfie_path?: string | null; has_pin: boolean; languages: string[];
  };
  kyc_missing: string[];
  documents: DocInfo[];
  supervisor?: { name: string; phone?: string | null } | null;
  site?: SiteInfo | null;
  agency: { id: string; name: string; status: string; timezone: string; late_threshold_min: number; location_off_warn_min: number; outage_threshold_min: number };
  config?: AppConfig | null;
  server_time?: string;
};
export type ShiftInfo = {
  id: string; site_id: string; site_name?: string | null; shift_date: string; scheduled_start?: string | null; scheduled_end?: string | null;
  status: string; attendance: string; started_at?: string | null; start_captured_at?: string | null; ended_at?: string | null;
  flags: string[]; trust?: string | null; late_by_min: number; worked_minutes: number; away_seconds: number;
  location_enabled: boolean; location_off_seconds: number; has_exception: boolean; shift_type?: string | null;
};
export type PatrolInfo = {
  id: string; route_id?: string | null; route_name?: string | null; min_photos: number; frequency_min?: number | null; grace_min?: number | null;
  expected_at?: string | null; started_at?: string | null; ended_at?: string | null; status: string; distance_m?: number | null; duration_s?: number | null;
};
export type TaskInfo = {
  id: string; title: string; description?: string | null; due_at?: string | null; photo_required: boolean; site_id: string; site_name?: string | null;
  status: string; started_at?: string | null; completed_at?: string | null; photo_path?: string | null;
};
export type Home = { today: string; server_time?: string; active_shift_id: string | null; shifts: ShiftInfo[]; patrols: PatrolInfo[]; tasks: TaskInfo[]; unread_notifications: number };
export type LeaveRequest = { id: string; type: string; start_date: string; end_date: string; reason?: string | null; status: string; decided_at?: string | null; decision_note?: string | null; created_at: string };
export type LeaveBalance = { year: number; casual_total: number; earned_total: number; casual_used: number; earned_used: number; unpaid_used: number };
export type NotificationItem = { id: string; title: string; body?: string | null; created_at: string; read_at?: string | null; payload?: Record<string, unknown> | null };
export type ShiftRecord = Omit<ShiftInfo, "site_name" | "location_enabled" | "location_off_seconds" | "has_exception" | "shift_type" | "start_captured_at"> & { sites?: { name: string } | null };
export type Ping = { recorded_at: string; lat: number; lng: number; accuracy_m?: number | null; speed_mps?: number | null; battery_pct?: number | null; is_mock?: boolean };
export type CheckInResult = { id: string; status: string; flags: string[]; start_in_fence?: boolean | null; start_distance_m?: number | null; late_by_min: number };
export type CheckOutResult = { id: string; status: string; attendance: string; worked_minutes: number; away_seconds: number; flags: string[] };
export type PatrolPhoto = { file_path: string; lat?: number | null; lng?: number | null; taken_at?: string | null };
