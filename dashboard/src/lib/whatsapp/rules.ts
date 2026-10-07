/**
 * Alert rules: which GuardWatch AI event sends which template to whom, and what happens when
 * nobody answers. An alert to a guard climbs a ladder — guard, then supervisor, then a voice
 * call — and stops at the first rung that replies.
 */

export type Trigger =
  | "absent_rollcall" | "incident" | "incident_report" | "long_break" | "missing"
  | "shift_reminder" | "missed_check_in" | "alertness_check" | "left_fence" | "patrol_due" | "sos"
  | "roster_published" | "leave_decided" | "inspection_failed" | "visitor_waiting";

export const TRIGGERS: Record<Trigger, { label: string; event: string; critical: boolean }> = {
  absent_rollcall: { label: "Guards absent on duty", event: "15 min after shift start: everyone not checked in, with phone numbers", critical: true },
  incident: { label: "Incident reported", event: "A guard or supervisor logs an incident", critical: true },
  incident_report: { label: "Incident photo report", event: "Photos and summary filed for a high or critical incident", critical: false },
  long_break: { label: "Unusually long break", event: "On break longer than the site allows", critical: false },
  missing: { label: "Guard gone missing", event: "On shift, not seen for 2× the staleness limit or far outside the fence", critical: true },
  shift_reminder: { label: "Shift starts soon", event: "60 min before a rostered shift", critical: false },
  missed_check_in: { label: "Missed check-in", event: "No check-in 10 min after shift start", critical: true },
  alertness_check: { label: "Alertness (sleep) check", event: "Random prompt on night shifts", critical: true },
  left_fence: { label: "Left the site fence", event: "On duty and outside the fence for 5 min", critical: true },
  patrol_due: { label: "Patrol round due", event: "A scheduled round has not started", critical: false },
  sos: { label: "SOS raised", event: "Guard pressed SOS in the app", critical: true },
  roster_published: { label: "Roster published", event: "Next week's roster is saved", critical: false },
  leave_decided: { label: "Leave decided", event: "A supervisor approves or declines leave", critical: false },
  inspection_failed: { label: "Floor check failed", event: "A survey answer fails", critical: false },
  visitor_waiting: { label: "Visitor at the gate", event: "A walk-in needs the host's yes", critical: false },
};

export type Rung = { after_min: number; to: "guard" | "supervisor" | "site_lead" | "owner" | "voice_call" | "host"; template_id: string | null };

export type AlertRule = {
  id: string;
  trigger: Trigger;
  enabled: boolean;
  template_id: string;
  ladder: Rung[];
  quiet_hours: { from: string; to: string } | null;
  sms_fallback: boolean;
  sent_7d: number;
  ack_rate: number;
};

export const RUNG_LABEL: Record<Rung["to"], string> = {
  guard: "Guard",
  supervisor: "Site supervisor",
  site_lead: "Field officer",
  owner: "Agency owner",
  voice_call: "Automated voice call",
  host: "Host (tenant contact)",
};

export const RULES: AlertRule[] = [
  { id: "r-a", trigger: "absent_rollcall", enabled: true, template_id: "t-absent", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-absent" }, { after_min: 20, to: "site_lead", template_id: "t-absent" }, { after_min: 40, to: "owner", template_id: "t-absent" }], quiet_hours: null, sms_fallback: true, sent_7d: 21, ack_rate: 0.95 },
  { id: "r-b", trigger: "incident", enabled: true, template_id: "t-incident", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-incident" }, { after_min: 5, to: "site_lead", template_id: "t-incident" }, { after_min: 10, to: "owner", template_id: "t-incident" }], quiet_hours: null, sms_fallback: true, sent_7d: 6, ack_rate: 1 },
  { id: "r-c", trigger: "incident_report", enabled: true, template_id: "t-report", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-report" }, { after_min: 30, to: "owner", template_id: "t-report" }], quiet_hours: null, sms_fallback: false, sent_7d: 4, ack_rate: 0.75 },
  { id: "r-d", trigger: "long_break", enabled: true, template_id: "t-break", ladder: [{ after_min: 0, to: "guard", template_id: "t-break" }, { after_min: 5, to: "supervisor", template_id: "t-break-sup" }], quiet_hours: null, sms_fallback: false, sent_7d: 17, ack_rate: 0.88 },
  { id: "r-e", trigger: "missing", enabled: true, template_id: "t-missing", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-missing" }, { after_min: 3, to: "voice_call", template_id: null }, { after_min: 10, to: "owner", template_id: "t-missing" }], quiet_hours: null, sms_fallback: true, sent_7d: 5, ack_rate: 1 },
  { id: "r-1", trigger: "shift_reminder", enabled: true, template_id: "t-shift", ladder: [{ after_min: 0, to: "guard", template_id: "t-shift" }], quiet_hours: null, sms_fallback: false, sent_7d: 412, ack_rate: 0.81 },
  { id: "r-2", trigger: "missed_check_in", enabled: true, template_id: "t-missed", ladder: [{ after_min: 0, to: "guard", template_id: "t-missed" }, { after_min: 10, to: "supervisor", template_id: "t-missed" }, { after_min: 20, to: "voice_call", template_id: null }], quiet_hours: null, sms_fallback: true, sent_7d: 37, ack_rate: 0.89 },
  { id: "r-3", trigger: "alertness_check", enabled: true, template_id: "t-awake", ladder: [{ after_min: 0, to: "guard", template_id: "t-awake" }, { after_min: 5, to: "voice_call", template_id: null }, { after_min: 8, to: "supervisor", template_id: "t-sos" }], quiet_hours: null, sms_fallback: false, sent_7d: 186, ack_rate: 0.94 },
  { id: "r-4", trigger: "left_fence", enabled: true, template_id: "t-fence", ladder: [{ after_min: 0, to: "guard", template_id: "t-fence" }, { after_min: 10, to: "supervisor", template_id: "t-fence" }], quiet_hours: null, sms_fallback: false, sent_7d: 22, ack_rate: 0.77 },
  { id: "r-5", trigger: "patrol_due", enabled: true, template_id: "t-patrol", ladder: [{ after_min: 0, to: "guard", template_id: "t-patrol" }, { after_min: 15, to: "supervisor", template_id: null }], quiet_hours: null, sms_fallback: false, sent_7d: 64, ack_rate: 0.72 },
  { id: "r-6", trigger: "sos", enabled: true, template_id: "t-sos", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-sos" }, { after_min: 2, to: "site_lead", template_id: "t-sos" }, { after_min: 5, to: "owner", template_id: "t-sos" }], quiet_hours: null, sms_fallback: true, sent_7d: 3, ack_rate: 1 },
  { id: "r-7", trigger: "roster_published", enabled: true, template_id: "t-roster", ladder: [{ after_min: 0, to: "guard", template_id: "t-roster" }], quiet_hours: { from: "21:00", to: "08:00" }, sms_fallback: false, sent_7d: 58, ack_rate: 0.64 },
  { id: "r-8", trigger: "leave_decided", enabled: false, template_id: "t-leave", ladder: [{ after_min: 0, to: "guard", template_id: "t-leave" }], quiet_hours: { from: "21:00", to: "08:00" }, sms_fallback: false, sent_7d: 0, ack_rate: 0 },
  { id: "r-9", trigger: "inspection_failed", enabled: true, template_id: "t-inspect", ladder: [{ after_min: 0, to: "supervisor", template_id: "t-inspect" }], quiet_hours: { from: "22:00", to: "07:00" }, sms_fallback: false, sent_7d: 9, ack_rate: 0.78 },
  { id: "r-10", trigger: "visitor_waiting", enabled: true, template_id: "t-visitor", ladder: [{ after_min: 0, to: "host", template_id: "t-visitor" }], quiet_hours: null, sms_fallback: true, sent_7d: 143, ack_rate: 0.91 },
];

/** "HH:MM" inside a window that may wrap midnight (21:00–08:00). */
export function inQuietHours(hhmm: string, window: { from: string; to: string } | null): boolean {
  if (!window) return false;
  const { from, to } = window;
  return from <= to ? hhmm >= from && hhmm < to : hhmm >= from || hhmm < to;
}

export type RungState = "no_reply" | "answered" | "skipped" | "waiting" | "queued";

/**
 * How the ladder stands `elapsedMin` minutes after the event, if the first reply arrives
 * `answeredAtMin` minutes in (null: nobody replies). A reply only counts once it has happened,
 * and it belongs to the rung that was the latest to fire before it; every later rung is skipped.
 */
export function playLadder(ladder: Rung[], elapsedMin: number, answeredAtMin: number | null): { rung: Rung; state: RungState }[] {
  const answered = answeredAtMin != null && answeredAtMin <= elapsedMin ? answeredAtMin : null;
  return ladder.map((rung, i) => {
    const next = ladder[i + 1];
    if (answered != null && answered < rung.after_min) return { rung, state: "skipped" };
    if (elapsedMin < rung.after_min) return { rung, state: "queued" };
    if (answered != null && (!next || answered < next.after_min)) return { rung, state: "answered" };
    if (!next || elapsedMin < next.after_min) return { rung, state: "waiting" };
    return { rung, state: "no_reply" };
  });
}

/** Indicative Meta pricing for India, per template message (utility). Shown as an estimate only. */
export const UTILITY_INR = 0.115;
export const MARKETING_INR = 0.785;

export function estimateCost(recipients: number, category: "UTILITY" | "MARKETING" | "AUTHENTICATION"): number {
  const unit = category === "MARKETING" ? MARKETING_INR : UTILITY_INR;
  return Math.round(recipients * unit * 100) / 100;
}
