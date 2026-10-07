import { APP_URL } from "@/lib/brand";

/**
 * WhatsApp message templates. Anything we send first (an alert, a reminder) has to be a
 * template Meta approved in advance; free text is only allowed inside the 24-hour window
 * after the guard last wrote to us. Variables are positional: {{1}}, {{2}}, …
 */

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type TemplateStatus = "approved" | "pending" | "rejected" | "paused" | "draft";
export type Audience = "guard" | "supervisor" | "host";
export type Lang = "en" | "hi" | "kn" | "ta";

export const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिन्दी Hindi", kn: "ಕನ್ನಡ Kannada", ta: "தமிழ் Tamil" };

export type TemplateButton = { type: "quick_reply"; text: string } | { type: "url"; text: string; url: string } | { type: "call"; text: string; phone: string };

export type WaTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  language: Lang;
  status: TemplateStatus;
  audience: Audience;
  header: string | null;
  /** An image header carries a photo (incident reports); `header` then describes it. */
  header_type?: "text" | "image";
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  /** Example values, in order, sent to Meta for review and used for the preview. */
  samples: string[];
  /** What each variable is filled from, in order. */
  variables: string[];
  rejection_reason?: string;
};

const VAR = /\{\{(\d+)\}\}/g;

/** Distinct variable numbers in the order they first appear. */
export function variablesIn(text: string): number[] {
  const seen: number[] = [];
  for (const m of text.matchAll(VAR)) {
    const n = Number(m[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

export function render(text: string, values: string[]): string {
  return text.replace(VAR, (_, n) => values[Number(n) - 1] || `{{${n}}}`);
}

/** The checks Meta's review applies that we can catch before submitting. */
export function validateTemplate(t: Pick<WaTemplate, "name" | "body" | "header" | "footer" | "buttons" | "samples">): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) errors.push("Name: lowercase letters, digits and underscores only.");
  if (!t.body.trim()) errors.push("Body cannot be empty.");
  if (t.body.length > 1024) errors.push(`Body is ${t.body.length} characters; the limit is 1024.`);
  if (t.header && t.header.length > 60) errors.push("Header is limited to 60 characters.");
  if (t.footer && t.footer.length > 60) errors.push("Footer is limited to 60 characters.");
  const vars = variablesIn(t.body);
  const sorted = [...vars].sort((a, b) => a - b);
  if (sorted.some((n, i) => n !== i + 1)) errors.push("Variables must be numbered {{1}}, {{2}}, … with no gaps.");
  if (/^\s*\{\{\d+\}\}/.test(t.body) || /\{\{\d+\}\}\s*[.!?]?\s*$/.test(t.body)) errors.push("Body cannot start or end with a variable.");
  if (vars.length > 0 && t.samples.filter((s) => s.trim()).length < vars.length) errors.push("Give an example value for every variable.");
  const quick = t.buttons.filter((b) => b.type === "quick_reply");
  if (quick.length > 3) errors.push("Up to 3 quick-reply buttons.");
  if (t.buttons.some((b) => b.text.length > 25)) errors.push("Button text is limited to 25 characters.");
  return errors;
}

export const TEMPLATE_STATUS: Record<TemplateStatus, { label: string; tone: "present" | "half-day" | "absent" | "neutral" }> = {
  approved: { label: "Approved", tone: "present" },
  pending: { label: "In review", tone: "half-day" },
  rejected: { label: "Rejected", tone: "absent" },
  paused: { label: "Paused by Meta", tone: "absent" },
  draft: { label: "Draft", tone: "neutral" },
};

export const TEMPLATES: WaTemplate[] = [
  {
    id: "t-absent", name: "absent_guards_rollcall", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "Absent on duty", body: "Hello {{1}}, {{2}} guard(s) have not reported for the {{3}} shift at {{4}}: {{5}}. Tap a number to call, or arrange relief below.",
    footer: "GuardWatch AI", buttons: [{ type: "quick_reply", text: "Arranging relief" }, { type: "quick_reply", text: "Guards informed me" }, { type: "url", text: "Open roster", url: `${APP_URL}/roster/{{1}}` }],
    samples: ["Priya", "2", "Day", "Prestige Tech Park — Gate 3", "1) Ramesh Kumar · +91 99000 00001 | 2) Mohan Das · +91 99000 00003"],
    variables: ["Supervisor first name", "How many", "Shift", "Site", "Names and phone numbers"],
  },
  {
    id: "t-incident", name: "incident_alert", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "🚨 Incident reported", body: "New incident — {{1}} at {{2}}: {{3}}. Severity {{4}}, reported by {{5}} at {{6}}. Reply to take it, or call the guard.",
    footer: "GuardWatch AI", buttons: [{ type: "quick_reply", text: "I'm on it" }, { type: "call", text: "Call reporter", phone: "+919900000001" }, { type: "url", text: "Open incident", url: `${APP_URL}/i/{{1}}` }],
    samples: ["Theft", "Metro Cash & Carry, Yeshwanthpur", "Copper cable missing from loading bay", "high", "Gopal Reddy", "02:14"],
    variables: ["Incident type", "Site", "Title", "Severity", "Reported by", "Time"],
  },
  {
    id: "t-report", name: "incident_photo_report", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "Photo of the scene", header_type: "image",
    body: "Incident report — {{1}} at {{2}}. What happened: {{3}}. Action taken: {{4}}. {{5}} photo(s) attached, reported by {{6}}. Tap below to acknowledge.",
    footer: "Full report and all photos in GuardWatch AI", buttons: [{ type: "quick_reply", text: "Acknowledge" }, { type: "url", text: "Open full report", url: `${APP_URL}/i/{{1}}` }],
    samples: ["Fire", "Sobha Dream Acres", "Smoke from the DG room at 13:40", "Extinguisher used, DG shut, facility called", "3", "Harish Naik"],
    variables: ["Incident type", "Site", "Summary", "Action taken", "Photo count", "Reported by"],
  },
  {
    id: "t-break", name: "long_break_guard", category: "UTILITY", language: "hi", status: "approved", audience: "guard",
    header: null, body: "नमस्ते {{1}} जी, आपका ब्रेक {{2}} मिनट से चल रहा है (अनुमति {{3}} मिनट)। कृपया {{4}} पर अपनी पोस्ट पर लौटें।",
    footer: "No reply in 5 min alerts your supervisor", buttons: [{ type: "quick_reply", text: "पोस्ट पर वापस ✅" }, { type: "quick_reply", text: "10 मिनट और" }],
    samples: ["Ramesh", "48", "30", "Gate 3"], variables: ["Guard first name", "Minutes on break", "Allowed minutes", "Post"],
  },
  {
    id: "t-break-sup", name: "long_break_supervisor", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "Long break", body: "Heads-up {{1}}: {{2}} has been on break for {{3}} min (allowed {{4}}) at {{5}} and did not answer the bot. Phone: {{6}} — please check on them.",
    footer: "GuardWatch AI", buttons: [{ type: "call", text: "Call guard", phone: "+919900000001" }, { type: "quick_reply", text: "Sending relief" }, { type: "quick_reply", text: "Mark missing" }],
    samples: ["Priya", "Ramesh Kumar", "58", "30", "Prestige Tech Park — Gate 3", "+91 99000 00001"],
    variables: ["Supervisor first name", "Guard", "Minutes on break", "Allowed", "Site", "Guard phone"],
  },
  {
    id: "t-missing", name: "guard_missing", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "⚠ Guard not seen", body: "Alert {{1}}: {{2}} has not been seen for {{3}} min during the {{4}} shift at {{5}}. Last seen: {{6}}. Phone: {{7}} — call before sending relief.",
    footer: "GuardWatch AI", buttons: [{ type: "quick_reply", text: "Calling now" }, { type: "quick_reply", text: "Sending relief" }, { type: "url", text: "Live map", url: `${APP_URL}/live?g={{1}}` }],
    samples: ["Arun", "Gopal Reddy", "42", "Night", "Metro Cash & Carry, Yeshwanthpur", "160 m outside the fence, 01:12", "+91 99000 00012"],
    variables: ["Supervisor first name", "Guard", "Minutes unseen", "Shift", "Site", "Last seen", "Guard phone"],
  },
  {
    id: "t-shift", name: "shift_reminder", category: "UTILITY", language: "en", status: "approved", audience: "guard",
    header: "Shift reminder", body: "Namaste {{1}}, your {{2}} shift at {{3}} starts at {{4}}. Please check in from the GuardWatch AI app inside the site fence.",
    footer: "GuardWatch AI · reply STOP to opt out", buttons: [{ type: "quick_reply", text: "On my way" }, { type: "quick_reply", text: "Running late" }, { type: "quick_reply", text: "Can't come" }],
    samples: ["Ramesh", "Night", "Prestige Tech Park — Gate 3", "22:00"], variables: ["Guard first name", "Shift name", "Site", "Shift start"],
  },
  {
    id: "t-missed", name: "missed_check_in", category: "UTILITY", language: "en", status: "approved", audience: "guard",
    header: "⚠ Check-in missing", body: "Hello {{1}}, your shift at {{2}} started at {{3}} and we have no check-in yet. Reply below so your supervisor knows.",
    footer: null, buttons: [{ type: "quick_reply", text: "Checking in now" }, { type: "quick_reply", text: "Phone problem" }, { type: "quick_reply", text: "Not coming" }],
    samples: ["Suresh", "Brigade Meadows", "06:00"], variables: ["Guard first name", "Site", "Shift start"],
  },
  {
    id: "t-awake", name: "alertness_check", category: "UTILITY", language: "hi", status: "approved", audience: "guard",
    header: null, body: "नमस्ते {{1}} जी, अलर्टनेस चेक: 5 मिनट के अंदर नीचे का बटन दबाएँ। ({{2}}, {{3}})",
    footer: "No reply in 5 min alerts your supervisor", buttons: [{ type: "quick_reply", text: "मैं जाग रहा हूँ ✅" }],
    samples: ["Mohan", "Metro Cash & Carry", "02:40"], variables: ["Guard first name", "Site", "Time"],
  },
  {
    id: "t-fence", name: "left_site_fence", category: "UTILITY", language: "en", status: "approved", audience: "guard",
    header: null, body: "Hello {{1}}, your phone shows you {{2}} outside the {{3}} fence during your shift. Please return to your post or tell us why.",
    footer: null, buttons: [{ type: "quick_reply", text: "Back at post" }, { type: "quick_reply", text: "On a site errand" }],
    samples: ["Harish", "140 m", "Sobha Dream Acres"], variables: ["Guard first name", "Distance", "Site"],
  },
  {
    id: "t-patrol", name: "patrol_round_due", category: "UTILITY", language: "kn", status: "approved", audience: "guard",
    header: null, body: "ನಮಸ್ಕಾರ {{1}}, {{2}} ಗಸ್ತು ಸುತ್ತು {{3}} ಕ್ಕೆ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಆ್ಯಪ್‌ನಲ್ಲಿ ಪ್ರಾರಂಭಿಸಿ.",
    footer: null, buttons: [{ type: "quick_reply", text: "Starting now" }],
    samples: ["Ramesh", "Perimeter", "23:30"], variables: ["Guard first name", "Route", "Due time"],
  },
  {
    id: "t-sos", name: "sos_raised_supervisor", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "🚨 SOS", body: "SOS from {{1}} at {{2}}, {{3}}. Location: {{4}}. Tap below to take it, or call the guard now.",
    footer: null, buttons: [{ type: "quick_reply", text: "I'm on it" }, { type: "call", text: "Call guard", phone: "+919900000001" }],
    samples: ["Suresh Gowda", "Prestige Tech Park — Gate 3", "14:12", "maps.app.goo.gl/x7Qp"], variables: ["Guard name", "Site", "Time", "Map link"],
  },
  {
    id: "t-roster", name: "roster_published", category: "UTILITY", language: "en", status: "approved", audience: "guard",
    header: null, body: "Hello {{1}}, next week's roster is out. You are on {{2}} at {{3}}. Weekly off: {{4}}. Reply if this does not work for you.",
    footer: null, buttons: [{ type: "url", text: "See my roster", url: `${APP_URL}/r/{{1}}` }],
    samples: ["Mohan", "Day shift (06:00–14:00)", "Metro Cash & Carry", "Sunday"], variables: ["Guard first name", "Shift", "Site", "Weekly off"],
  },
  {
    id: "t-leave", name: "leave_decision", category: "UTILITY", language: "en", status: "pending", audience: "guard",
    header: null, body: "Hello {{1}}, your leave for {{2}} was {{3}} by {{4}}. Open the app for details.",
    footer: null, buttons: [],
    samples: ["Harish", "12–14 Oct", "approved", "Priya Nair"], variables: ["Guard first name", "Dates", "Decision", "Decided by"],
  },
  {
    id: "t-inspect", name: "inspection_fault_owner", category: "UTILITY", language: "en", status: "approved", audience: "supervisor",
    header: "Floor check failed", body: "Floor check failed — {{1}} on {{2}}: {{3}}. Reported by {{4}} with a photo. A task has been opened for you.",
    footer: null, buttons: [{ type: "quick_reply", text: "Acknowledge" }, { type: "url", text: "Open task", url: `${APP_URL}/t/{{1}}` }],
    samples: ["Fire safety", "2nd floor (Northwind)", "Fire exit blocked", "Ramesh Kumar"], variables: ["Category", "Floor", "Fault", "Guard name"],
  },
  {
    id: "t-visitor", name: "visitor_at_gate", category: "UTILITY", language: "en", status: "approved", audience: "host",
    header: "Visitor at the gate", body: "Hello {{1}}, {{2}} from {{3}} is at {{4}} to see you. Purpose: {{5}}. Shall we let them in?",
    footer: "Sent by the security desk", buttons: [{ type: "quick_reply", text: "Approve" }, { type: "quick_reply", text: "Deny" }, { type: "url", text: "See photo & ID", url: `${APP_URL}/a/{{1}}` }],
    samples: ["Farah", "Karan Mehta", "Zephyr Logistics", "Gate 2", "Courier contract renewal"], variables: ["Host first name", "Visitor", "Company", "Gate", "Purpose"],
  },
  {
    id: "t-promo", name: "festival_bonus_offer", category: "MARKETING", language: "en", status: "rejected", audience: "guard",
    header: null, body: "Refer a friend and win {{1}} this Diwali!", footer: null, buttons: [],
    samples: ["₹2,000"], variables: ["Amount"], rejection_reason: "Marketing category is not allowed for this number's use case; ends with a variable.",
  },
];
