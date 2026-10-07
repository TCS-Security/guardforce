import { render, TEMPLATES } from "./templates";
import { BOT_DISPLAY_NAME } from "@/lib/brand";
import { firstName } from "./messages";

/**
 * The master bot: one verified WhatsApp Business number that every alert goes out from, to
 * guards and to supervisors. Four alerts carry most of the weight:
 *
 *   1. absent roll-call — who has not reported for a shift, with phone numbers, to the supervisor
 *   2. incident — the moment one is logged
 *   3. long break / gone missing — a guard off post for longer than the site allows
 *   4. incident photo report — photos and a summary of a major incident
 *
 * Alerts are built from real rows where the database has them (absences, incidents, presence)
 * and topped up with a sample so every kind can be shown in a demo.
 */

export const BOT = {
  name: BOT_DISPLAY_NAME,
  number: "+91 80 4718 2200",
  quality: "High" as "High" | "Medium" | "Low",
  tier: "10K conversations / day",
};

export type BotKind = "absent_rollcall" | "incident" | "incident_report" | "long_break" | "missing";

export const BOT_KIND: Record<BotKind, { label: string; template: string; to: string }> = {
  absent_rollcall: { label: "Absent on duty", template: "t-absent", to: "Supervisor" },
  incident: { label: "Incident", template: "t-incident", to: "Supervisor → field officer → owner" },
  incident_report: { label: "Incident photo report", template: "t-report", to: "Supervisor + owner" },
  long_break: { label: "Long break", template: "t-break", to: "Guard, then supervisor" },
  missing: { label: "Guard missing", template: "t-missing", to: "Supervisor, then a call" },
};

export type BotConfig = { break_allowed_min: number; missing_after_min: number; outside_far_m: number };
export const BOT_DEFAULTS: BotConfig = { break_allowed_min: 30, missing_after_min: 30, outside_far_m: 150 };

export type GuardWatch = {
  guard_id: string;
  name: string;
  phone: string | null;
  site: string;
  shift: string;
  on_shift: boolean;
  last_seen_at: string | null;
  in_fence: boolean | null;
  outside_m?: number | null;
  break_started_at?: string | null;
};

export type WatchState = { state: "ok" | "long_break" | "missing"; minutes: number; reason: string };

/** Is this on-shift guard on an overlong break, or gone? Missing outranks a long break. */
export function classify(w: GuardWatch, now: Date, cfg: BotConfig = BOT_DEFAULTS): WatchState {
  if (!w.on_shift) return { state: "ok", minutes: 0, reason: "Off shift" };
  const mins = (iso: string | null | undefined) => (iso ? Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000) : Infinity);
  const unseen = mins(w.last_seen_at);
  if (unseen >= cfg.missing_after_min) {
    return { state: "missing", minutes: Number.isFinite(unseen) ? unseen : cfg.missing_after_min, reason: Number.isFinite(unseen) ? `not seen for ${unseen} min` : "never seen this shift" };
  }
  if (w.in_fence === false && (w.outside_m ?? 0) >= cfg.outside_far_m && !w.break_started_at) {
    return { state: "missing", minutes: unseen, reason: `${w.outside_m} m outside the fence` };
  }
  const onBreak = mins(w.break_started_at);
  if (w.break_started_at && onBreak > cfg.break_allowed_min) {
    return { state: "long_break", minutes: onBreak, reason: `on break ${onBreak} min (allowed ${cfg.break_allowed_min})` };
  }
  return { state: "ok", minutes: 0, reason: "On post" };
}

/** "+91 99000 00001" from any stored form. */
export function fmtWaPhone(phone: string | null | undefined): string {
  if (!phone) return "no phone on file";
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone;
}

/**
 * The roll-call list. WhatsApp refuses newlines inside a template variable, so the names are
 * numbered on one line; the phone numbers are written out so they are tappable in the chat.
 */
export function absenteeList(guards: { name: string; phone: string | null }[]): string {
  return guards.map((g, i) => `${i + 1}) ${g.name} · ${fmtWaPhone(g.phone)}`).join(" | ");
}

export type Recipient = { name: string; phone: string | null; role: "guard" | "supervisor" | "owner" };

export type BotAlert = {
  id: string;
  kind: BotKind;
  at: string;
  site: string;
  subject: { name: string; phone: string | null } | null;
  recipients: Recipient[];
  template_id: string;
  values: string[];
  image: string | null;
  detail: string;
  state: "delivered" | "read" | "acknowledged" | "escalated";
  ack: { by: string; text: string; at: string } | null;
  source: "live" | "sample";
  /** For the roll-call: the absentees, so the dashboard can list them with call buttons. */
  people?: { name: string; phone: string | null }[];
  severity?: string;
};

export function alertText(a: Pick<BotAlert, "template_id" | "values">): string {
  const t = TEMPLATES.find((x) => x.id === a.template_id);
  return t ? render(t.body, a.values) : "";
}

/** A stand-in "photo of the scene" for sample reports: an SVG, so nothing is fetched. */
export function scenePhoto(kind: string, caption: string): string {
  const hue = { fire: 25, theft: 250, medical: 150, trespass: 60, vandalism: 300 }[kind] ?? 95;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},28%,42%)'/><stop offset='1' stop-color='hsl(${hue},30%,16%)'/></linearGradient></defs>
<rect width='640' height='480' fill='url(#g)'/>
<path d='M0 360 L220 250 L420 250 L640 360 Z' fill='rgba(0,0,0,0.25)'/>
<rect x='250' y='150' width='140' height='110' fill='rgba(255,255,255,0.10)' stroke='rgba(255,255,255,0.35)'/>
${kind === "fire" ? "<ellipse cx='320' cy='170' rx='90' ry='60' fill='rgba(220,220,220,0.35)'/><ellipse cx='350' cy='130' rx='70' ry='45' fill='rgba(200,200,200,0.3)'/>" : "<circle cx='320' cy='205' r='26' fill='rgba(255,140,60,0.75)'/>"}
<rect y='402' width='640' height='78' fill='rgba(0,0,0,0.6)'/>
<text x='20' y='432' font-family='monospace' font-size='18' fill='#efe9cf'>● ${caption.replace(/[<&'"]/g, "")}</text>
<text x='20' y='460' font-family='monospace' font-size='14' fill='#efe9cf' opacity='0.8'>GuardWatch AI verified capture · GPS fixed</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type BotInput = {
  now: Date;
  supervisors: { name: string; phone: string | null; sites: string[] }[];
  absences: { site: string; shift: string; date: string; guards: { name: string; phone: string | null }[] }[];
  incidents: { id: string; type: string; title: string; description: string; severity: string; site: string; occurred_at: string; reporter: string | null; reporter_phone: string | null }[];
  watches: GuardWatch[];
  cfg?: BotConfig;
};

const TYPE_LABEL = (t: string) => t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function buildBotAlerts(input: BotInput): BotAlert[] {
  const { now } = input;
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const supFor = (site: string): Recipient => {
    const s = input.supervisors.find((x) => x.sites.includes(site)) ?? input.supervisors[0];
    return { name: s?.name ?? "Site supervisor", phone: s?.phone ?? null, role: "supervisor" };
  };
  const alerts: BotAlert[] = [];

  // 1. Absent roll-call.
  const absences = input.absences.length
    ? input.absences.map((a) => ({ ...a, source: "live" as const }))
    : [{ site: "Prestige Tech Park — Gate 3", shift: "Day", date: "", guards: [{ name: "Ramesh Kumar", phone: "919900000001" }, { name: "Mohan Das", phone: "919900000003" }], source: "sample" as const }];
  absences.forEach((a, i) => {
    const sup = supFor(a.site);
    alerts.push({
      id: `ab-${i}`, kind: "absent_rollcall", at: ago(18 + i * 240), site: a.site, subject: null, recipients: [sup],
      template_id: "t-absent", values: [firstName(sup.name), String(a.guards.length), a.shift, a.site, absenteeList(a.guards)],
      image: null, detail: `${a.guards.length} absent for the ${a.shift.toLowerCase()} shift`, people: a.guards,
      state: i === 0 ? "read" : "acknowledged", ack: i === 0 ? null : { by: sup.name, text: "Arranging relief", at: ago(10 + i * 240) }, source: a.source,
    });
  });

  // 2 + 4. Incidents, and a photo report for the serious ones.
  const incidents = input.incidents.length
    ? input.incidents.map((x) => ({ ...x, source: "live" as const }))
    : [{ id: "sample", type: "fire", title: "Smoke from the DG room", description: "Smoke seen from the DG room vent; DG shut down, extinguisher used.", severity: "high", site: "Sobha Dream Acres", occurred_at: ago(95), reporter: "Harish Naik", reporter_phone: "919900000013", source: "sample" as const }];
  incidents.slice(0, 4).forEach((x, i) => {
    const sup = supFor(x.site);
    const at = new Date(x.occurred_at);
    const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(at);
    const reporter = x.reporter ?? "Site guard";
    alerts.push({
      id: `in-${x.id}`, kind: "incident", at: x.occurred_at, site: x.site, subject: { name: reporter, phone: x.reporter_phone },
      recipients: [sup, { name: "Field officer", phone: null, role: "supervisor" }], template_id: "t-incident",
      values: [TYPE_LABEL(x.type), x.site, x.title, x.severity, reporter, hhmm], image: null,
      detail: x.title, severity: x.severity,
      state: i === 0 && x.source === "live" ? "escalated" : "acknowledged",
      ack: i === 0 && x.source === "live" ? null : { by: sup.name, text: "I'm on it", at: new Date(at.getTime() + 3 * 60_000).toISOString() },
      source: x.source,
    });
    if (x.severity === "high" || x.severity === "critical" || x.source === "sample") {
      const summary = x.description.length > 140 ? `${x.description.slice(0, 137)}…` : x.description;
      alerts.push({
        id: `rp-${x.id}`, kind: "incident_report", at: new Date(at.getTime() + 25 * 60_000).toISOString(), site: x.site,
        subject: { name: reporter, phone: x.reporter_phone }, recipients: [sup, { name: "Agency owner", phone: null, role: "owner" }],
        template_id: "t-report", values: [TYPE_LABEL(x.type), x.site, summary.replace(/\.$/, ""), "Area secured, supervisor informed", "3", reporter],
        image: scenePhoto(x.type, `${TYPE_LABEL(x.type)} · ${x.site}`), detail: `3 photos · ${x.title}`, severity: x.severity,
        state: "read", ack: null, source: x.source,
      });
    }
  });

  // 3. Long breaks and missing guards.
  const cfg = input.cfg ?? BOT_DEFAULTS;
  // Real watches first; a sample for any state the live data has none of (breaks are not
  // recorded by the guard app yet, so a long break is always a sample for now).
  const live = input.watches.filter((w) => classify(w, now, cfg).state !== "ok").map((w) => ({ w, sample: false }));
  const has = (st: WatchState["state"]) => live.some(({ w }) => classify(w, now, cfg).state === st);
  const watches = [
    ...live,
    ...(has("missing") ? [] : [{ w: { guard_id: "s1", name: "Gopal Reddy", phone: "919900000012", site: "Metro Cash & Carry, Yeshwanthpur", shift: "Night", on_shift: true, last_seen_at: ago(42), in_fence: false, outside_m: 160 } as GuardWatch, sample: true }]),
    ...(has("long_break") ? [] : [{ w: { guard_id: "s2", name: "Ramesh Kumar", phone: "919900000001", site: "Prestige Tech Park — Gate 3", shift: "Day", on_shift: true, last_seen_at: ago(1), in_fence: true, break_started_at: ago(58) } as GuardWatch, sample: true }]),
  ];
  watches.forEach(({ w, sample }, i) => {
    const c = classify(w, now, cfg);
    const sup = supFor(w.site);
    if (c.state === "missing") {
      const last = w.last_seen_at
        ? `${w.in_fence === false && w.outside_m ? `${w.outside_m} m outside the fence` : "inside the fence"}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(w.last_seen_at))}`
        : "never this shift";
      alerts.push({
        id: `ms-${w.guard_id}`, kind: "missing", at: ago(Math.max(0, c.minutes - cfg.missing_after_min) + 1 + i), site: w.site,
        subject: { name: w.name, phone: w.phone }, recipients: [sup], template_id: "t-missing",
        values: [firstName(sup.name), w.name, String(c.minutes), w.shift, w.site, last, fmtWaPhone(w.phone)], image: null,
        detail: c.reason, state: "escalated", ack: null, source: sample ? "sample" : "live",
      });
    } else {
      alerts.push({
        id: `br-${w.guard_id}`, kind: "long_break", at: ago(Math.max(0, c.minutes - cfg.break_allowed_min) + i), site: w.site,
        subject: { name: w.name, phone: w.phone }, recipients: [{ name: w.name, phone: w.phone, role: "guard" }, sup], template_id: "t-break",
        values: [firstName(w.name), String(c.minutes), String(cfg.break_allowed_min), w.site], image: null,
        detail: c.reason, state: "read", ack: null, source: sample ? "sample" : "live",
      });
    }
  });

  return alerts.sort((a, b) => b.at.localeCompare(a.at));
}
