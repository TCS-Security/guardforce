/**
 * Sales pipeline rules, in plain words.
 *
 * A lead is Hot, Warm or Cold. The rep never sees points: they see the label and one to four
 * plain reasons, each with where the fact came from. These functions are pure so the same rules
 * run in the import scripts, the server actions that create or edit leads, and the unit tests.
 */
import { haversineMeters } from "./geo";

export type Segment =
  | "apartment" | "developer_project" | "factory" | "office" | "it_park" | "hospital" | "school" | "college"
  | "hotel" | "mall" | "jeweller" | "govt" | "warehouse" | "bank" | "agency" | "other";
export type SizeUnit = "flats" | "beds" | "students" | "rooms" | "acres" | "sq_ft" | "guards";
export type IncumbentSoftware = "none" | "weak" | "strong" | "national";
export type Label = "hot" | "warm" | "cold";
export type Stage = "new" | "called" | "meeting" | "proposal" | "won" | "lost";

export type Reason = {
  kind: "size" | "handover" | "construction" | "tender" | "incumbent" | "near" | "note";
  text: string;
  /** Short source name shown on the right of the reason ("RERA", "GeM", "Website", "You", "Our research"). */
  source: string;
  url?: string | null;
};

/** The facts a lead carries; every field is optional because most leads are part-known. */
export type LeadFacts = {
  segment: Segment;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
  completion_on?: string | null;
  tender_closes_on?: string | null;
  tender_ends_on?: string | null;
  tender_value_inr?: number | null;
  tender_guards?: number | null;
  incumbent_agency?: string | null;
  incumbent_software?: IncumbentSoftware | null;
  incumbent_source?: string | null;
  source?: string | null;
  source_url?: string | null;
};

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const SEGMENTS: Record<Segment, { label: string; whoToAsk: string; designations: string[]; medianGuards: number }> = {
  apartment: {
    label: "Apartment",
    whoToAsk: "Residents' association President or Secretary, or the estate manager.",
    designations: ["Association President", "Association Secretary", "Treasurer", "Estate Manager", "Facility Manager"],
    medianGuards: 8,
  },
  developer_project: {
    label: "Developer project",
    whoToAsk: "The developer's facility or CRM head, or the project site in-charge.",
    designations: ["Facility Head", "CRM Head", "Project Manager", "Site In-charge", "Purchase Manager"],
    medianGuards: 4,
  },
  factory: {
    label: "Factory",
    whoToAsk: "The plant head, or the HR / Admin manager who usually owns security.",
    designations: ["Plant Head", "HR Manager", "Admin Manager", "EHS Manager", "Purchase Manager", "Director"],
    medianGuards: 12,
  },
  office: {
    label: "Office",
    whoToAsk: "The Admin or Facility head.",
    designations: ["Admin Head", "Facility Manager", "Office Manager", "Security Manager", "Procurement"],
    medianGuards: 6,
  },
  it_park: {
    label: "IT park",
    whoToAsk: "The park operator's operations or facility head, or the park security manager.",
    designations: ["GM Operations", "Facility Head", "Security Manager", "Property Manager"],
    medianGuards: 40,
  },
  hospital: {
    label: "Hospital",
    whoToAsk: "The hospital administrator or COO.",
    designations: ["Administrator", "COO", "Medical Superintendent", "Security Officer", "Purchase Manager"],
    medianGuards: 15,
  },
  school: {
    label: "School",
    whoToAsk: "The trust secretary, the principal, or the administrator.",
    designations: ["Principal", "Trust Secretary", "Correspondent", "Administrator"],
    medianGuards: 3,
  },
  college: {
    label: "College",
    whoToAsk: "The registrar or administrative officer, or the trust secretary.",
    designations: ["Registrar", "Administrative Officer", "Principal", "Trust Secretary"],
    medianGuards: 6,
  },
  hotel: {
    label: "Hotel",
    whoToAsk: "The general manager or the security head.",
    designations: ["General Manager", "Security Manager", "Chief Security Officer", "Purchase Manager"],
    medianGuards: 6,
  },
  mall: {
    label: "Mall",
    whoToAsk: "The mall manager or the mall security manager.",
    designations: ["Mall Manager", "Centre Director", "Security Manager", "Operations Head"],
    medianGuards: 15,
  },
  jeweller: {
    label: "Jeweller",
    whoToAsk: "The owner, or the head of loss prevention at a chain.",
    designations: ["Owner", "Director", "Store Manager", "Loss Prevention Head"],
    medianGuards: 3,
  },
  govt: {
    label: "Government",
    whoToAsk: "The officer named in the tender, or the estate / admin section.",
    designations: ["Estate Officer", "Admin Officer", "Tender Officer", "Section Officer"],
    medianGuards: 6,
  },
  warehouse: {
    label: "Warehouse",
    whoToAsk: "The warehouse or regional operations manager.",
    designations: ["Warehouse Manager", "Regional Ops Head", "Loss Prevention Head", "Admin Manager"],
    medianGuards: 6,
  },
  bank: {
    label: "Bank",
    whoToAsk: "The branch manager, or the regional admin / premises team.",
    designations: ["Branch Manager", "Regional Admin", "Premises Manager"],
    medianGuards: 1,
  },
  agency: {
    label: "Security agency",
    whoToAsk: "The owner / MD, or the operations head.",
    designations: ["Owner", "Managing Director", "Operations Head", "Director", "Manager"],
    medianGuards: 0,
  },
  other: {
    label: "Other",
    whoToAsk: "Whoever looks after admin or facilities.",
    designations: ["Admin Head", "Facility Manager", "Owner"],
    medianGuards: 4,
  },
};

export const STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "called", label: "Called" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export const LOST_REASONS = ["Price", "Kept old agency", "Not interested", "Couldn't reach", "Other"] as const;

export const CALL_OUTCOMES = [
  { key: "reached", label: "Reached" },
  { key: "no_answer", label: "No answer" },
  { key: "wrong_number", label: "Wrong number" },
  { key: "wrong_person", label: "Not the right person" },
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number]["key"];

export const LABEL_META: Record<Label, { label: string; tone: "signal" | "half-day" | "neutral" }> = {
  hot: { label: "Hot", tone: "signal" },
  warm: { label: "Warm", tone: "half-day" },
  cold: { label: "Cold", tone: "neutral" },
};

const SOURCE_NAME: Record<string, string> = {
  rera: "RERA",
  gem: "GeM",
  osm: "OpenStreetMap",
  kpme: "KPME",
  nabh: "NABH",
  agency_index: "Agency website",
  sheet: "Our sheet",
  google_maps: "Google Maps",
  linkedin: "LinkedIn",
  manual: "You",
  rep: "You",
};
export function sourceName(source: string | null | undefined): string {
  if (!source) return "You";
  return SOURCE_NAME[source] ?? source;
}

/** Monthly value of one guard to an agency, used only for the rough "≈ ₹/month" line. */
export const RUPEES_PER_GUARD_MONTH = 30_000;
/** Paid mobile lookups we fund per agency per calendar month. */
export const LOOKUP_MONTHLY_CAP = 50;
/** "Near your site" distance. */
export const NEAR_SITE_METERS = 3_000;

// ---------------------------------------------------------------------------
// Size → guards → money
// ---------------------------------------------------------------------------

/** Rough guards a site needs, or null when nothing is known about its size. */
export function guardsFromSize(f: Pick<LeadFacts, "segment" | "size_value" | "size_unit" | "tender_guards" | "tender_value_inr">): number | null {
  if (f.tender_guards && f.tender_guards > 0) return Math.round(f.tender_guards);
  const v = f.size_value ?? null;
  if (v != null && v > 0) {
    switch (f.size_unit) {
      case "guards": return Math.round(v);
      case "flats": return Math.max(2, Math.round(v / 45));
      case "beds": return Math.max(3, Math.round(v / 12));
      case "students": return Math.max(2, Math.round(v / 300) + 1);
      case "rooms": return Math.max(3, Math.round(v / 25) + 2);
      case "acres": return Math.max(2, Math.round(v * 1.2) + 2);
      case "sq_ft": return Math.max(2, Math.round(v / 25_000) + 1);
      default: break;
    }
  }
  if (f.tender_value_inr && f.tender_value_inr > 0) return Math.max(1, Math.round(f.tender_value_inr / (RUPEES_PER_GUARD_MONTH * 12)));
  return null;
}

/** Guards estimate used for the label: the size estimate, else the segment's typical figure. */
export function estimateGuards(f: LeadFacts): { guards: number; estimated: boolean; known: boolean } {
  const g = guardsFromSize(f);
  if (g != null) return { guards: g, estimated: f.size_unit !== "guards" && !f.tender_guards, known: true };
  return { guards: SEGMENTS[f.segment].medianGuards, estimated: true, known: false };
}

/** "₹4.2 lakh" style, for a monthly figure. */
export function fmtRupeesShort(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)} crore`;
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)} lakh`;
  if (amount >= 1_000) return `₹${trim(amount / 1_000)}k`;
  return `₹${Math.round(amount)}`;
}
function trim(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "640 flats", "220 beds", "₹38 lakh/yr tender". */
export function sizeText(f: Pick<LeadFacts, "size_value" | "size_unit" | "tender_value_inr" | "tender_guards">): string | null {
  if (f.size_value && f.size_unit) {
    const n = Math.round(Number(f.size_value));
    const unit = f.size_unit === "sq_ft" ? "sq ft" : f.size_unit;
    return `${n.toLocaleString("en-IN")} ${unit}`;
  }
  if (f.tender_guards) return `${f.tender_guards} guards in tender`;
  if (f.tender_value_inr) return `${fmtRupeesShort(f.tender_value_inr)} tender`;
  return null;
}

// ---------------------------------------------------------------------------
// The label and the reasons
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
function daysBetween(fromIso: string, to: Date) {
  return Math.round((new Date(`${fromIso}T00:00:00Z`).getTime() - Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())) / DAY);
}
function monthYear(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}
function dayMonth(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export type Assessment = { label: Label; reasons: Reason[]; guards: number; guardsKnown: boolean; timing: boolean };

/**
 * Hot / Warm / Cold from what we know about a place.
 *
 * - Hot: big enough to matter, and either its current agency is weak (no app) or there is a
 *   reason to switch now (handover, tender, new campus).
 * - Cold: too small, or guarded by an agency that already runs strong software, with no reason
 *   to switch now.
 * - Warm: everything else, which is most leads until someone finds out more.
 */
export function assessLead(f: LeadFacts, today: Date = new Date()): Assessment {
  const reasons: Reason[] = [];
  const src = sourceName(f.source);
  const { guards, known } = estimateGuards(f);

  // Size
  const size = sizeText(f);
  if (known && guards > 0) {
    const money = fmtRupeesShort(guards * RUPEES_PER_GUARD_MONTH);
    const big = guards >= 15 ? "Big: " : "";
    reasons.push({
      kind: "size",
      text: `${big}${size ? `${size}, ` : ""}about ${guards} guard${guards === 1 ? "" : "s"} needed (≈ ${money}/month)`,
      source: src,
      url: f.source_url,
    });
  }

  // Timing: handover / construction
  let timing = false;
  if (f.completion_on) {
    const d = daysBetween(f.completion_on, today);
    if (d <= 0 && d >= -365) {
      timing = true;
      reasons.push({ kind: "handover", text: `Handed over to residents around ${monthYear(f.completion_on)}; the residents now choose their own agency`, source: src, url: f.source_url });
    } else if (d > 0 && d <= 270) {
      timing = true;
      reasons.push({ kind: "handover", text: `Due for handover in ${monthYear(f.completion_on)}; the residents' association will pick an agency`, source: src, url: f.source_url });
    } else if (d > 270 && f.segment === "developer_project") {
      reasons.push({ kind: "construction", text: `Under construction (ready ${monthYear(f.completion_on)}); the site needs guards now, and the agency often stays after handover`, source: src, url: f.source_url });
    }
  }

  // Timing: tenders
  if (f.tender_closes_on) {
    const d = daysBetween(f.tender_closes_on, today);
    if (d >= 0) {
      timing = true;
      reasons.push({ kind: "tender", text: `Government tender open till ${dayMonth(f.tender_closes_on)}`, source: src, url: f.source_url });
    }
  }
  if (f.tender_ends_on) {
    const d = daysBetween(f.tender_ends_on, today);
    if (d >= 0 && d <= 183) {
      timing = true;
      reasons.push({ kind: "tender", text: `Current guarding contract ends around ${monthYear(f.tender_ends_on)}`, source: src, url: f.source_url });
    }
  }

  // Incumbent
  const sw = f.incumbent_software ?? null;
  const agency = f.incumbent_agency?.trim();
  if (agency) {
    const isrc = f.incumbent_source ? sourceName(f.incumbent_source) : "Our research";
    const text =
      sw === "none" ? `Current agency: ${agency}. No app seen on their website`
      : sw === "weak" ? `Current agency: ${agency}. Basic tech only, no proper guard app`
      : sw === "strong" ? `Current agency: ${agency} already uses guard software; harder to win`
      : sw === "national" ? `Guarded by ${agency}, a national firm with its own tech; hard to win`
      : `Current agency: ${agency}`;
    reasons.push({ kind: "incumbent", text, source: isrc });
  }

  // Label
  const weak = sw === "none" || sw === "weak";
  const strong = sw === "strong" || sw === "national";
  const small = known ? guards <= 5 : SEGMENTS[f.segment].medianGuards <= 3;
  const premiumSmall = f.segment === "jeweller" || f.segment === "bank";
  let label: Label;
  if (strong && !timing) label = "cold";
  else if (small && !premiumSmall && !(timing && f.segment === "govt")) label = "cold";
  else if (guards >= 10 && (weak || timing)) label = "hot";
  else if (premiumSmall && weak) label = "hot";
  else label = "warm";

  return { label, reasons: orderReasons(reasons), guards, guardsKnown: known, timing };
}

const REASON_ORDER: Reason["kind"][] = ["handover", "tender", "incumbent", "size", "near", "construction", "note"];
export function orderReasons(reasons: Reason[]): Reason[] {
  return [...reasons].sort((a, b) => REASON_ORDER.indexOf(a.kind) - REASON_ORDER.indexOf(b.kind));
}

// ---------------------------------------------------------------------------
// Near the agency's own sites
// ---------------------------------------------------------------------------

export function nearestSite(
  point: { lat: number | null | undefined; lng: number | null | undefined },
  sites: { id: string; name: string; lat: number; lng: number }[],
): { site: { id: string; name: string }; meters: number } | null {
  if (point.lat == null || point.lng == null) return null;
  let best: { site: { id: string; name: string }; meters: number } | null = null;
  for (const s of sites) {
    const m = haversineMeters(point.lat, point.lng, s.lat, s.lng);
    if (!best || m < best.meters) best = { site: { id: s.id, name: s.name }, meters: m };
  }
  return best;
}

export function nearReason(near: { site: { name: string }; meters: number } | null): Reason | null {
  if (!near || near.meters > NEAR_SITE_METERS) return null;
  const km = near.meters < 1000 ? `${Math.round(near.meters / 10) * 10} m` : `${(near.meters / 1000).toFixed(1)} km`;
  return { kind: "near", text: `${km} from your site at ${near.site.name}`, source: "You" };
}

/** Stored reasons plus the live "near your site" one, in display order. */
export function displayReasons(stored: unknown, near: { site: { name: string }; meters: number } | null): Reason[] {
  const reasons = Array.isArray(stored) ? (stored as Reason[]) : [];
  const n = nearReason(near);
  const out = reasons.filter((r) => r.kind !== "near");
  if (n) out.push(n);
  return orderReasons(out).slice(0, 5);
}

// ---------------------------------------------------------------------------
// What to say
// ---------------------------------------------------------------------------

export function pitchLines(reasons: Reason[], segment: Segment): string[] {
  const kinds = new Set(reasons.map((r) => r.kind));
  const lines: string[] = [];
  const incumbent = reasons.find((r) => r.kind === "incumbent");
  if (segment === "agency") {
    lines.push("You can show every client live guard attendance and patrol photos, and stop the disputes over unmanned hours.");
    lines.push("Payroll at the new 2026 minimum wage, with PF and ESI worked out, in a few clicks.");
    return lines;
  }
  if (kinds.has("handover")) lines.push("Now that the residents run security, you'll want daily proof the guards are doing their job. We show attendance and patrols on your phone.");
  if (kinds.has("tender")) lines.push("We'd like to be on the bidder list for your next security contract. We can share our PSARA licence and past work.");
  if (incumbent && /No app|Basic tech/.test(incumbent.text)) lines.push("Can you see right now which guard is on your gate? With us you can, live on your phone.");
  if (kinds.has("near")) lines.push("We already guard a site close to you, so a supervisor can reach your gate in minutes.");
  if (kinds.has("construction")) lines.push("We can guard the site through construction and stay on after handover, so the residents start with a team that knows the place.");
  if (lines.length < 2) lines.push("With the new minimum wage, many clients are re-quoting. We'll give you a clear, fully compliant quote.");
  return lines.slice(0, 2);
}

// ---------------------------------------------------------------------------
// The paid "Find mobile number" button
// ---------------------------------------------------------------------------

export function lookupGate(input: {
  label: Label;
  guards: number;
  guardsKnown: boolean;
  incumbentSoftware: IncumbentSoftware | null | undefined;
  timing: boolean;
  hasMobile: boolean;
  usedThisMonth: number;
}): { show: boolean; allowed: boolean; why: string } {
  const top =
    input.label === "hot" &&
    input.guardsKnown && input.guards >= 15 &&
    (input.incumbentSoftware === "none" || input.incumbentSoftware === "weak" || input.timing);
  if (!top) return { show: false, allowed: false, why: "Only for the best leads: Hot, big, and a weak current agency or a reason to switch now." };
  if (input.hasMobile) return { show: false, allowed: false, why: "There is already a mobile number for the people on this lead." };
  if (input.usedThisMonth >= LOOKUP_MONTHLY_CAP) return { show: true, allowed: false, why: `This month's ${LOOKUP_MONTHLY_CAP} lookups are used up.` };
  return { show: true, allowed: true, why: `${LOOKUP_MONTHLY_CAP - input.usedThisMonth} of ${LOOKUP_MONTHLY_CAP} lookups left this month` };
}

// ---------------------------------------------------------------------------
// Numbers: best first
// ---------------------------------------------------------------------------

const STATUS_RANK = { worked: 0, unknown: 1, no_answer: 2, wrong: 9 } as const;
const KIND_RANK = { mobile: 0, office: 1, email: 2 } as const;
export function sortNumbers<T extends { kind: "mobile" | "office" | "email"; status: keyof typeof STATUS_RANK }>(nums: T[]): T[] {
  return [...nums].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}

/** tel: link value — digits only, Indian numbers get +91. */
export function telHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  const d = digits.replace(/^0+/, "");
  return d.length === 10 ? `tel:+91${d}` : `tel:${digits}`;
}
export function whatsappHref(value: string): string | null {
  const d = value.replace(/\D/g, "").replace(/^0+/, "");
  // Callers offer WhatsApp only on numbers marked mobile: an 080 landline and an 80xx mobile look alike.
  if (d.length === 10 && /^[6-9]/.test(d)) return `https://wa.me/91${d}`;
  if (d.length === 12 && /^91[6-9]/.test(d)) return `https://wa.me/${d}`;
  return null;
}

export function linkedinSearchUrl(org: string, designation?: string): string {
  const q = [designation, org].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}
export function mapsSearchUrl(name: string, address?: string | null, lat?: number | null, lng?: number | null): string {
  const q = address ? [name, address].join(", ") : lat != null && lng != null ? `${name} @ ${lat},${lng}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Calling a lead moves it from New to Called; later stages are left alone. */
export function stageAfterCall(stage: Stage): Stage {
  return stage === "new" ? "called" : stage;
}
