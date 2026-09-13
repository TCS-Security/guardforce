import type {
  AttendanceStatus, ShiftStatus, TrustLevel, EventType, EventSeverity, PatrolStatus, TaskStatus, LeaveStatus, LeaveType, DocumentType, DocumentStatus, GuardPresence,
} from "@/lib/supabase/types";

export type Tone = "present" | "half-day" | "absent" | "on-leave" | "neutral" | "signal" | "olive";

export const ATTENDANCE: Record<AttendanceStatus, { label: string; short: string; tone: Tone }> = {
  present: { label: "Present", short: "P", tone: "present" },
  half_day: { label: "Half day", short: "H", tone: "half-day" },
  absent: { label: "Absent", short: "A", tone: "absent" },
  on_leave: { label: "On leave", short: "L", tone: "on-leave" },
  pending: { label: "Pending", short: "–", tone: "neutral" },
};

export const SHIFT_STATUS: Record<ShiftStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  in_progress: { label: "On duty", tone: "present" },
  completed: { label: "Completed", tone: "olive" },
  void_location_off: { label: "Void — location off", tone: "absent" },
  absent: { label: "No show", tone: "absent" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const TRUST: Record<TrustLevel, { label: string; tone: Tone; hint: string }> = {
  clean: { label: "Clean", tone: "present", hint: "In fence, good GPS accuracy, no tamper signals" },
  flagged: { label: "Flagged", tone: "half-day", hint: "Outside fence, poor accuracy, low battery or synced late" },
  suspicious: { label: "Suspicious", tone: "absent", hint: "Mock location or location switched off" },
};

export const FLAG_LABELS: Record<string, string> = {
  OUTSIDE_FENCE: "Outside fence",
  LATE_START: "Late start",
  EARLY_CHECKOUT: "Early checkout",
  LOCATION_OFF: "Location off",
  TAMPER_SUSPECTED: "Mock GPS",
  SYNCED_LATE: "Synced late",
  LOW_ACCURACY: "Low GPS accuracy",
};

export const EVENT_META: Record<EventType, { label: string; group: "attendance" | "location" | "patrol" | "task" | "leave" | "admin" }> = {
  CHECK_IN: { label: "Check-in", group: "attendance" },
  CHECK_OUT: { label: "Check-out", group: "attendance" },
  OUTSIDE_FENCE: { label: "Outside fence", group: "attendance" },
  LATE_START: { label: "Late start", group: "attendance" },
  EARLY_CHECKOUT: { label: "Early checkout", group: "attendance" },
  SYNCED_LATE: { label: "Synced late", group: "attendance" },
  FENCE_EXIT: { label: "Fence exit", group: "location" },
  FENCE_ENTER: { label: "Fence enter", group: "location" },
  LOCATION_OFF: { label: "Location off", group: "location" },
  LOCATION_ON: { label: "Location on", group: "location" },
  OUTAGE: { label: "Outage", group: "location" },
  TAMPER_SUSPECTED: { label: "Mock GPS", group: "location" },
  SHIFT_VOID: { label: "Shift void", group: "attendance" },
  EXCEPTION_LOGGED: { label: "Exception logged", group: "admin" },
  ATTENDANCE_OVERRIDE: { label: "Attendance corrected", group: "admin" },
  STAFFING_GAP: { label: "Staffing gap", group: "admin" },
  PATROL_STARTED: { label: "Patrol started", group: "patrol" },
  PATROL_COMPLETED: { label: "Patrol completed", group: "patrol" },
  PATROL_LATE: { label: "Patrol late", group: "patrol" },
  PATROL_MISSED: { label: "Patrol missed", group: "patrol" },
  TASK_DONE: { label: "Task done", group: "task" },
  TASK_MISSED: { label: "Task missed", group: "task" },
  LEAVE_REQUESTED: { label: "Leave requested", group: "leave" },
  LEAVE_DECIDED: { label: "Leave decided", group: "leave" },
};

export const SEVERITY_TONE: Record<EventSeverity, Tone> = { info: "neutral", warn: "half-day", critical: "absent" };

export const PATROL_STATUS: Record<PatrolStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Due", tone: "neutral" },
  in_progress: { label: "In progress", tone: "olive" },
  completed: { label: "On time", tone: "present" },
  late: { label: "Late", tone: "half-day" },
  missed: { label: "Missed", tone: "absent" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_progress: { label: "In progress", tone: "olive" },
  done: { label: "Done", tone: "present" },
  missed: { label: "Missed", tone: "absent" },
};

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "half-day" },
  approved: { label: "Approved", tone: "present" },
  declined: { label: "Declined", tone: "absent" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const LEAVE_TYPE: Record<LeaveType, string> = { casual: "Casual", earned: "Earned", unpaid: "Unpaid" };

export const DOCUMENT_TYPES: { type: DocumentType; label: string; required: boolean; hint: string }[] = [
  { type: "aadhaar", label: "Aadhaar card", required: true, hint: "Store masked; last 4 digits only" },
  { type: "pan", label: "PAN card", required: true, hint: "" },
  { type: "police_verification", label: "Police verification", required: true, hint: "PVC from local police station" },
  { type: "guard_kyc", label: "Guard KYC form", required: true, hint: "Agency's own verification record" },
  { type: "marksheet", label: "10th / 12th marksheet", required: false, hint: "Optional" },
];

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting review", tone: "half-day" },
  verified: { label: "Verified", tone: "present" },
  rejected: { label: "Rejected", tone: "absent" },
};

/** Live-map presence state derived from last-seen staleness (LOC-2) and location flag. */
export type PresenceState = "live" | "stale" | "location_off" | "off_duty";

export function presenceState(p: Pick<GuardPresence, "last_seen_at" | "location_enabled" | "shift_id">, stalenessMin = 15, now = new Date()): PresenceState {
  if (!p.shift_id) return "off_duty";
  if (!p.location_enabled) return "location_off";
  if (!p.last_seen_at) return "stale";
  const ageMin = (now.getTime() - new Date(p.last_seen_at).getTime()) / 60000;
  return ageMin > stalenessMin ? "stale" : "live";
}

/** Staffing gap: required minus currently on duty. Positive = short. */
export function staffingGap(required: number, onDuty: number) {
  return Math.max(0, required - onDuty);
}
