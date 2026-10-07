import type { IdType, Tenant, Visitor, VisitorStatus, VisitorType } from "./types";
import type { Tone } from "@/lib/domain/status";

/**
 * The visitor lifecycle at the gate:
 *
 *   expected (host pre-authorised) ─┐
 *   pending (walk-in, host asked) ──┼─ approve ─> approved ─ check in ─> checked_in ─ check out ─> checked_out
 *                                   └─ deny ────> rejected (blocked: cannot be checked in)
 *
 * Every transition is a pure function that either returns the next visitor or says why not,
 * so the desk, the host's WhatsApp reply and the approval link all go through the same rules.
 */

export const VISITOR_STATUS: Record<VisitorStatus, { label: string; tone: Tone }> = {
  expected: { label: "Expected", tone: "on-leave" },
  pending: { label: "Awaiting host", tone: "half-day" },
  approved: { label: "Approved", tone: "olive" },
  checked_in: { label: "On premises", tone: "present" },
  checked_out: { label: "Checked out", tone: "neutral" },
  rejected: { label: "Denied by host", tone: "absent" },
};

export const VISITOR_TYPE: Record<VisitorType, string> = {
  client: "Client / meeting",
  vendor: "Vendor / partner",
  contractor: "Contractor / tech support",
  interview: "Interview candidate",
  delivery: "Delivery / courier",
  guest: "Personal guest",
};

export const ID_TYPE: Record<IdType, string> = {
  aadhaar: "Aadhaar",
  dl: "Driving licence",
  pan: "PAN card",
  voter: "Voter ID",
  passport: "Passport",
};

/** Default overstay limit. Hosts can extend a visit, which is what the watchlist action does. */
export const OVERSTAY_MIN = 120;

type Result = { ok: true; visitor: Visitor } | { ok: false; error: string };

export function approve(v: Visitor, by: string, via: Visitor["approval_via"], at: Date): Result {
  if (v.status === "approved" || v.status === "expected") return { ok: false, error: `${v.name} is already approved.` };
  if (v.status !== "pending") return { ok: false, error: `${v.name} is ${VISITOR_STATUS[v.status].label.toLowerCase()}; only a waiting visitor can be approved.` };
  return { ok: true, visitor: { ...v, status: "approved", approved_at: at.toISOString(), approved_by: by, approval_via: via } };
}

export function deny(v: Visitor, by: string, via: Visitor["approval_via"], at: Date): Result {
  if (v.status !== "pending" && v.status !== "expected") return { ok: false, error: `${v.name} can no longer be denied.` };
  return { ok: true, visitor: { ...v, status: "rejected", approved_at: at.toISOString(), approved_by: by, approval_via: via } };
}

export function checkIn(v: Visitor, guard: string, badge: string, at: Date): Result {
  if (v.status === "rejected") return { ok: false, error: `${v.name} was denied by the host and cannot be let in.` };
  if (v.status === "pending") return { ok: false, error: `Waiting for the host to approve ${v.name}.` };
  if (v.status !== "approved" && v.status !== "expected") return { ok: false, error: `${v.name} is already ${VISITOR_STATUS[v.status].label.toLowerCase()}.` };
  const b = badge.trim().toUpperCase();
  if (!b) return { ok: false, error: "Enter the visitor badge number you handed over." };
  return { ok: true, visitor: { ...v, status: "checked_in", checked_in_at: at.toISOString(), checked_in_by: guard, badge_no: b } };
}

export function checkOut(v: Visitor, guard: string, gateId: string, remarks: string, at: Date): Result {
  if (v.status !== "checked_in") return { ok: false, error: `${v.name} is not on the premises.` };
  return {
    ok: true,
    visitor: { ...v, status: "checked_out", checked_out_at: at.toISOString(), checked_out_by: guard, exit_gate_id: gateId, exit_remarks: remarks.trim() || null },
  };
}

/** Minutes on premises so far (checked in) or in total (checked out). */
export function stayMinutes(v: Pick<Visitor, "checked_in_at" | "checked_out_at">, now: Date): number | null {
  if (!v.checked_in_at) return null;
  const end = v.checked_out_at ? new Date(v.checked_out_at) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(v.checked_in_at).getTime()) / 60_000));
}

export type WatchFlag = { visitor: Visitor; reason: "overstay" | "denied"; minutes: number | null };

/** Who the gate should be watching: anyone past the stay limit, and anyone a host refused today. */
export function watchlist(visitors: Visitor[], now: Date, limitMin = OVERSTAY_MIN): WatchFlag[] {
  const flags: WatchFlag[] = [];
  for (const v of visitors) {
    const m = stayMinutes(v, now);
    if (v.status === "checked_in" && m != null && m > limitMin) flags.push({ visitor: v, reason: "overstay", minutes: m });
    if (v.status === "rejected") flags.push({ visitor: v, reason: "denied", minutes: null });
  }
  return flags.sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));
}

export function visitorStats(visitors: Visitor[], now: Date) {
  const decided = visitors.filter((v) => v.approved_at && !v.pre_authorised);
  const approved = decided.filter((v) => v.status !== "rejected");
  const done = visitors.filter((v) => v.status === "checked_out");
  const stays = done.map((v) => stayMinutes(v, now)).filter((m): m is number => m != null);
  return {
    total: visitors.length,
    onPremises: visitors.filter((v) => v.status === "checked_in").length,
    pending: visitors.filter((v) => v.status === "pending").length,
    expected: visitors.filter((v) => v.status === "expected").length,
    checkedOut: done.length,
    denied: visitors.filter((v) => v.status === "rejected").length,
    approvalRate: decided.length ? Math.round((100 * approved.length) / decided.length) : null,
    avgStayMin: stays.length ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length) : null,
    viaWhatsapp: visitors.filter((v) => v.approval_via === "whatsapp").length,
  };
}

/** What the host fields fill in once the guard picks a tenant at the gate desk. */
export function autoFillFromTenant(tenant: Tenant, floorName: string) {
  return {
    floor: floorName,
    unit: tenant.unit,
    host: `${tenant.contact_name} (${tenant.contact_phone})`,
    message: `Floor “${floorName}” and unit “${tenant.unit}” set from the tenant record for ${tenant.name}.`,
  };
}

/** Next VIS-#### after the highest one in use. */
export function nextRef(prefix: string, refs: string[], start = 1000): string {
  const n = refs.reduce((max, r) => {
    const m = r.match(/(\d+)$/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, start);
  return `${prefix}-${n + 1}`;
}

/** Aadhaar and friends are never shown whole: XXXX-XXXX-1234. */
export function maskId(type: IdType, last4: string): string {
  return type === "aadhaar" ? `XXXX-XXXX-${last4}` : `••••${last4}`;
}

export type NewVisitorInput = {
  name: string;
  phone: string;
  company: string;
  type: VisitorType | "";
  id_type: IdType | "";
  id_number: string;
  tenant_id: string;
  purpose: string;
};

/** Field-level errors for the gate entry form; empty object means it can be submitted. */
export function validateVisitor(input: NewVisitorInput): Partial<Record<keyof NewVisitorInput, string>> {
  const e: Partial<Record<keyof NewVisitorInput, string>> = {};
  if (input.name.trim().length < 2) e.name = "Write the visitor's full name.";
  if (!/^[6-9]\d{9}$/.test(input.phone.replace(/\D/g, "").slice(-10))) e.phone = "A 10-digit Indian mobile number.";
  if (!input.company.trim()) e.company = "Which company or 'Self'.";
  if (!input.type) e.type = "Pick the kind of visit.";
  if (!input.id_type) e.id_type = "Pick the ID they showed.";
  const digits = input.id_number.replace(/\s|-/g, "");
  if (input.id_type === "aadhaar" && !/^\d{12}$/.test(digits)) e.id_number = "Aadhaar is 12 digits.";
  else if (digits.length < 4) e.id_number = "At least the last 4 characters of the ID.";
  if (!input.tenant_id) e.tenant_id = "Who are they here to see?";
  if (input.purpose.trim().length < 3) e.purpose = "A few words on why they are here.";
  return e;
}

/**
 * Preview only: a walk-in registered at the desk exists in nobody's database, so its approval
 * link carries the request itself, base64url-encoded. In production the link is a signed,
 * single-use token that resolves server-side; this is what that lookup would return.
 */
export type ApprovalCard = Pick<Visitor, "ref" | "name" | "company" | "type" | "purpose" | "tenant_id" | "gate_id" | "id_type" | "id_last4" | "arrived_at" | "photo_hue">;

export function encodeApprovalCard(v: ApprovalCard): string {
  const json = JSON.stringify([v.ref, v.name, v.company, v.type, v.purpose, v.tenant_id, v.gate_id, v.id_type, v.id_last4, v.arrived_at, v.photo_hue]);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeApprovalCard(s: string): ApprovalCard | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const a = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!Array.isArray(a) || a.length !== 11) return null;
    const [ref, name, company, type, purpose, tenant_id, gate_id, id_type, id_last4, arrived_at, photo_hue] = a;
    const str = (x: unknown, max = 120) => typeof x === "string" && x.length > 0 && x.length <= max;
    if (![ref, name, company, purpose, tenant_id, gate_id, id_last4, arrived_at].every((x) => str(x))) return null;
    if (!(type in VISITOR_TYPE) || !(id_type in ID_TYPE) || typeof photo_hue !== "number" || Number.isNaN(Date.parse(arrived_at))) return null;
    return { ref, name, company, type, purpose, tenant_id, gate_id, id_type, id_last4, arrived_at, photo_hue };
  } catch {
    return null;
  }
}
