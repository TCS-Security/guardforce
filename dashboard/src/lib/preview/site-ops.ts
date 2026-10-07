import { rng } from "./rng";
import { addDays, istInstant, type Crew, type CrewGuard, type CrewSite } from "./crew";

/* ── Post orders ─────────────────────────────────────────────────────────── */

export type PostOrderKind = "gate" | "patrol" | "visitor" | "emergency" | "general";

export const POST_ORDER_KIND: Record<PostOrderKind, string> = {
  gate: "Gate & access",
  patrol: "Patrol",
  visitor: "Visitors & vehicles",
  emergency: "Emergency",
  general: "General conduct",
};

export type PostOrder = {
  id: string;
  site_id: string;
  kind: PostOrderKind;
  title: string;
  steps: string[];
  version: number;
  updated_at: string;
  updated_by: string;
  /** Guards at the site and the version each one last acknowledged, if any. */
  acks: { guard: CrewGuard; version: number | null; at: string | null }[];
};

const TEMPLATES: { kind: PostOrderKind; title: string; steps: string[] }[] = [
  { kind: "gate", title: "Main gate — shift duties", steps: [
    "Take charge of keys, radio and the gate register from the outgoing guard; count them aloud.",
    "No vehicle enters without a pass or a call from the facility manager.",
    "Check boots and dickey of every goods vehicle; note the seal number in the register.",
    "Gate stays closed between 23:00 and 06:00; the wicket gate only.",
  ] },
  { kind: "visitor", title: "Visitor entry", steps: [
    "Ask for photo ID and the person being visited; call them before letting the visitor in.",
    "Issue a numbered visitor badge and write the badge number in the register.",
    "Collect the badge at exit. A badge not returned by 20:00 is reported to the supervisor.",
  ] },
  { kind: "patrol", title: "Night rounds", steps: [
    "Three rounds a night: 23:00, 02:00 and 04:30, scanning every checkpoint in the app.",
    "Check that the basement shutters, the DG room and the terrace door are locked.",
    "Photograph anything left open and log it as an incident.",
  ] },
  { kind: "emergency", title: "Fire and medical emergency", steps: [
    "Press SOS in the app first, then call 101 (fire) or 108 (ambulance).",
    "Open the main gate fully and keep the fire lane clear.",
    "Guide people to the assembly point by the front lawn; do not use the lifts.",
    "Do not leave the gate until the supervisor arrives.",
  ] },
  { kind: "general", title: "Conduct on post", steps: [
    "Full uniform and ID card at all times. No phone use except the guard app.",
    "No sleeping, no visitors of your own, no leaving the post without relief.",
    "Be polite to residents and staff; complaints go to the supervisor, not to them.",
  ] },
];

/** Three to five standing orders per site; some revised recently and not yet read by everyone. */
export function generatePostOrders(crew: Crew): PostOrder[] {
  const out: PostOrder[] = [];
  for (const site of crew.sites) {
    const r = rng(`po:${site.id}`);
    const guards = crew.guards.filter((g) => g.site_id === site.id);
    const picks = TEMPLATES.filter((_, i) => i < 2 || r.chance(0.6));
    for (const t of picks) {
      const version = r.int(1, 4);
      const ageDays = r.int(0, 40);
      const updated_at = istInstant(addDays(crew.today, -ageDays), r.int(9, 18), r.int(0, 59));
      const acks = guards.map((guard) => {
        const read = ageDays > 7 ? r.chance(0.95) : r.chance(0.55);
        return read
          ? { guard, version, at: istInstant(addDays(crew.today, -Math.max(0, ageDays - r.int(0, Math.min(ageDays, 3)))), r.int(7, 22)) }
          : { guard, version: version > 1 && r.chance(0.6) ? version - 1 : null, at: null };
      });
      out.push({ id: `po-${site.id}-${t.kind}`, site_id: site.id, kind: t.kind, title: t.title, steps: t.steps, version, updated_at, updated_by: r.pick(["Rajesh Menon", "Priya (supervisor)"]), acks });
    }
  }
  return out;
}

/** Guards who have read the current version, out of everyone posted at the site. */
export function ackProgress(order: Pick<PostOrder, "version" | "acks">): { read: number; total: number } {
  return { read: order.acks.filter((a) => a.version === order.version).length, total: order.acks.length };
}

/** A new version clears every acknowledgement of the old one. */
export function publishRevision(order: PostOrder, steps: string[], by: string, at: string): PostOrder {
  return { ...order, steps, version: order.version + 1, updated_at: at, updated_by: by };
}

/* ── Handover (pass-down) ────────────────────────────────────────────────── */

export type HandoverPriority = "routine" | "watch" | "urgent";

export type Handover = {
  id: string;
  site: CrewSite;
  from: CrewGuard;
  to: CrewGuard | null;
  at: string;
  priority: HandoverPriority;
  note: string;
  /** What physically changed hands. */
  items: string[];
  read_at: string | null;
};

const NOTES: { priority: HandoverPriority; text: string }[] = [
  { priority: "routine", text: "All quiet. Register written up to 07:55. Two courier parcels kept in the cabin for B-wing." },
  { priority: "routine", text: "Water tanker came at 05:30, 12 kL, slip in the register." },
  { priority: "watch", text: "Car KA-05-MX-2231 parked in visitor bay since evening, owner not traced. Keep an eye on it." },
  { priority: "watch", text: "Basement light near pillar 14 is not working. Maintenance informed, ticket #4471." },
  { priority: "urgent", text: "Back gate latch is broken — tied with chain for now. Do not leave the back gate unattended." },
  { priority: "routine", text: "Facility manager will come at 10:00 with the fire audit team. Keep the fire register ready." },
  { priority: "watch", text: "Ex-employee (Ravi, housekeeping) tried to enter at 22:10, turned back. Do not allow without HR call." },
  { priority: "urgent", text: "CCTV DVR showing no signal on camera 3 and 4 since 03:00. Informed the client's IT." },
];

const ITEMS = ["Gate keys ×3", "Radio", "Visitor register", "Torch", "Vehicle register", "Lathi", "Key box key"];

/** Two handovers a day per site over the last five days; today's not all read yet. */
export function generateHandovers(crew: Crew): Handover[] {
  const out: Handover[] = [];
  for (const site of crew.sites) {
    const guards = crew.guards.filter((g) => g.site_id === site.id);
    if (guards.length === 0) continue;
    const r = rng(`ho:${site.id}:${crew.today}`);
    for (let back = 0; back < 5; back++) {
      const date = addDays(crew.today, -back);
      for (const hour of [8, 20]) {
        if (back === 0 && hour === 20) continue;
        const n = r.pick(NOTES);
        const from = r.pick(guards);
        const to = guards.length > 1 ? r.pick(guards.filter((g) => g.id !== from.id)) : null;
        const at = istInstant(date, hour, r.int(-8, 6));
        out.push({
          id: `ho-${site.id}-${date}-${hour}`,
          site, from, to, at,
          priority: n.priority,
          note: n.text,
          items: ITEMS.filter(() => r.chance(0.45)).slice(0, 4),
          read_at: back === 0 && r.chance(0.5) ? null : new Date(new Date(at).getTime() + r.int(2, 15) * 60000).toISOString(),
        });
      }
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
