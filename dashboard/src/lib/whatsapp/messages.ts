import { rng } from "@/lib/campus/random";
import { render, TEMPLATES, type Lang, type WaTemplate } from "./templates";
import type { Trigger } from "./rules";

/**
 * The delivery log and per-guard opt-in register, generated around the real guards in scope.
 * WhatsApp reports four delivery states per message; a reply (button tap or text) is what
 * closes an alert.
 */

export type Delivery = "queued" | "sent" | "delivered" | "read" | "failed";

export type WaContact = {
  id: string;
  name: string;
  phone: string | null;
  role: "guard" | "supervisor" | "host";
  site: string | null;
  opted_in: boolean;
  opted_in_at: string | null;
  opt_in_source: "guard app" | "joining form" | "reply START" | null;
  language: Lang;
  last_inbound_at: string | null;
};

export type WaMessage = {
  id: string;
  contact_id: string;
  template_id: string;
  trigger: Trigger;
  direction: "out";
  body: string;
  sent_at: string;
  status: Delivery;
  failure?: string;
  reply: { text: string; at: string } | null;
  escalated: boolean;
  via_sms: boolean;
};

export type ChatLine = { id: string; from: "us" | "them"; text: string; at: string; status?: Delivery; buttons?: string[]; template?: string };

const TRIGGER_FOR: Record<string, Trigger> = {
  "t-absent": "absent_rollcall", "t-incident": "incident", "t-report": "incident_report", "t-break": "long_break",
  "t-break-sup": "long_break", "t-missing": "missing",
  "t-shift": "shift_reminder", "t-missed": "missed_check_in", "t-awake": "alertness_check", "t-fence": "left_fence",
  "t-patrol": "patrol_due", "t-sos": "sos", "t-roster": "roster_published", "t-leave": "leave_decided",
  "t-inspect": "inspection_failed", "t-visitor": "visitor_waiting",
};

export function deliveryStats(messages: WaMessage[]) {
  const n = messages.length;
  const delivered = messages.filter((m) => m.status === "delivered" || m.status === "read").length;
  const read = messages.filter((m) => m.status === "read").length;
  const replied = messages.filter((m) => m.reply).length;
  const failed = messages.filter((m) => m.status === "failed").length;
  const replyMins = messages
    .filter((m) => m.reply)
    .map((m) => (new Date(m.reply!.at).getTime() - new Date(m.sent_at).getTime()) / 60_000)
    .sort((a, b) => a - b);
  const median = replyMins.length ? replyMins[Math.floor(replyMins.length / 2)]! : null;
  const pct = (x: number) => (n ? Math.round((100 * x) / n) : 0);
  return { total: n, delivered, read, replied, failed, deliveredPct: pct(delivered), readPct: pct(read), repliedPct: pct(replied), medianReplyMin: median == null ? null : Math.round(median * 10) / 10, escalated: messages.filter((m) => m.escalated).length, sms: messages.filter((m) => m.via_sms).length };
}

/** Free text is only allowed within 24 h of the contact's last message to us. */
export function sessionOpen(c: Pick<WaContact, "last_inbound_at">, now: Date): boolean {
  return !!c.last_inbound_at && now.getTime() - new Date(c.last_inbound_at).getTime() < 24 * 3_600_000;
}

export function firstName(name: string) {
  return name.split(" ")[0] ?? name;
}

type GuardIn = { id: string; full_name: string; phone: string | null; site_name: string | null };

export function buildWhatsapp(guards: GuardIn[], supervisors: { id: string; full_name: string; phone: string | null }[], now: Date, seed: string) {
  const r = rng(`wa:${seed}`);
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  const langs: Lang[] = ["en", "hi", "kn", "en", "ta", "hi"];

  const contacts: WaContact[] = [
    ...guards.map((g, i) => {
      const opted = i % 7 !== 5;
      return {
        id: g.id, name: g.full_name, phone: g.phone, role: "guard" as const, site: g.site_name,
        opted_in: opted, opted_in_at: opted ? ago(r.int(3, 90) * 1440) : null,
        opt_in_source: opted ? r.pick(["guard app", "joining form", "reply START"] as const) : null,
        language: langs[i % langs.length]!, last_inbound_at: opted && r.chance(0.6) ? ago(r.int(5, 2000)) : null,
      };
    }),
    ...supervisors.map((s) => ({
      id: s.id, name: s.full_name, phone: s.phone, role: "supervisor" as const, site: null, opted_in: true,
      opted_in_at: ago(120 * 1440), opt_in_source: "joining form" as const, language: "en" as Lang, last_inbound_at: ago(r.int(10, 600)),
    })),
  ];

  const guardContacts = contacts.filter((c) => c.role === "guard" && c.opted_in);
  const supContacts = contacts.filter((c) => c.role === "supervisor");
  const tmpl = (id: string) => TEMPLATES.find((t) => t.id === id)!;

  const messages: WaMessage[] = [];
  const plan: [string, number][] = [
    ["t-awake", 9], ["t-shift", 14], ["t-missed", 22], ["t-fence", 38], ["t-shift", 55], ["t-patrol", 71], ["t-awake", 96],
    ["t-sos", 128], ["t-roster", 190], ["t-shift", 240], ["t-missed", 300], ["t-awake", 380], ["t-inspect", 420], ["t-shift", 500],
    ["t-awake", 610], ["t-fence", 700], ["t-roster", 820], ["t-shift", 980], ["t-patrol", 1100], ["t-awake", 1300],
  ];
  plan.forEach(([tid, mins], i) => {
    const t = tmpl(tid);
    const toSup = t.audience === "supervisor";
    const pool = toSup && supContacts.length ? supContacts : guardContacts;
    if (pool.length === 0) return;
    const c = pool[i % pool.length]!;
    const values = t.samples.map((s, k) => (k === 0 ? firstName(c.name) : k === 1 && c.site && t.variables[k] === "Site" ? c.site : s));
    const failed = i === 4 || i === 15;
    const status: Delivery = failed ? "failed" : i < 2 ? "delivered" : r.chance(0.82) ? "read" : "delivered";
    const replies = t.buttons.filter((b) => b.type === "quick_reply").map((b) => b.text);
    const replied = !failed && status === "read" && replies.length > 0 && (i === 0 ? false : r.chance(0.85));
    messages.push({
      id: `wm-${i + 1}`, contact_id: c.id, template_id: tid, trigger: TRIGGER_FOR[tid]!, direction: "out",
      body: render(t.body, values), sent_at: ago(mins), status,
      failure: failed ? (i === 4 ? "131026 · Number not on WhatsApp" : "131047 · Outside 24h window, template required") : undefined,
      reply: replied ? { text: replies[0]!, at: ago(mins - r.int(1, 6)) } : null,
      escalated: tid === "t-missed" && i === 10 ? true : tid === "t-awake" && !replied && i > 1,
      via_sms: failed && i === 4,
    });
  });

  return { contacts, messages };
}

/** The thread with one contact, newest last, built from the log plus their replies. */
export function threadFor(contactId: string, messages: WaMessage[], templates: WaTemplate[] = TEMPLATES): ChatLine[] {
  const lines: ChatLine[] = [];
  for (const m of messages.filter((x) => x.contact_id === contactId).sort((a, b) => a.sent_at.localeCompare(b.sent_at))) {
    const t = templates.find((x) => x.id === m.template_id);
    lines.push({
      id: m.id, from: "us", text: m.body, at: m.sent_at, status: m.status, template: t?.name,
      buttons: t?.buttons.map((b) => b.text),
    });
    if (m.reply) lines.push({ id: `${m.id}-r`, from: "them", text: m.reply.text, at: m.reply.at });
  }
  return lines;
}
