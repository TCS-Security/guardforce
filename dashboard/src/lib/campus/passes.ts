import type { GatePass, PassStatus, PassType } from "./types";
import type { Tone } from "@/lib/domain/status";

/**
 * Gate passes: the paper slips a gate runs on. A contractor's work permit, material coming in
 * against a challan, material going out (returnable or not), and a VIP pass. Each one names a
 * holder, a host, where they may go, which gates they may use and for how long.
 */
export const PASS_TYPE: Record<PassType, { label: string; short: string; prefix: string; tone: Tone }> = {
  work_permit: { label: "Contractor work permit", short: "Work permit", prefix: "WP", tone: "olive" },
  material_in: { label: "Material inward (challan)", short: "Material in", prefix: "MI", tone: "on-leave" },
  material_out: { label: "Material outward slip", short: "Material out", prefix: "MO", tone: "half-day" },
  vip: { label: "VIP / visitor security pass", short: "VIP pass", prefix: "VP", tone: "signal" },
};

export const PASS_STATUS: Record<PassStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "present" },
  closed: { label: "Closed", tone: "neutral" },
  expired: { label: "Expired", tone: "absent" },
  revoked: { label: "Revoked", tone: "absent" },
};

/** Stored status, except an active pass whose window has passed reads as expired. */
export function effectiveStatus(p: Pick<GatePass, "status" | "valid_to">, now: Date): PassStatus {
  if (p.status === "active" && new Date(p.valid_to).getTime() < now.getTime()) return "expired";
  return p.status;
}

/** "Valid for 3h 20m more" / "Expired 40m ago" / "Starts in 2h". */
export function validityLabel(p: Pick<GatePass, "valid_from" | "valid_to">, now: Date): string {
  const t = now.getTime();
  const from = new Date(p.valid_from).getTime();
  const to = new Date(p.valid_to).getTime();
  const span = (ms: number) => {
    const m = Math.round(Math.abs(ms) / 60_000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
    return `${Math.round(h / 24)}d`;
  };
  if (t < from) return `Starts in ${span(from - t)}`;
  if (t > to) return `Ended ${span(t - to)} ago`;
  return `${span(to - t)} left`;
}

export type NewPassInput = {
  type: PassType | "";
  title: string;
  holder: string;
  firm: string;
  phone: string;
  tenant_id: string;
  gate_ids: string[];
  valid_from: string;
  valid_to: string;
};

export function validatePass(input: NewPassInput): Partial<Record<keyof NewPassInput, string>> {
  const e: Partial<Record<keyof NewPassInput, string>> = {};
  if (!input.type) e.type = "Pick the kind of pass.";
  if (input.title.trim().length < 4) e.title = "What is the pass for?";
  if (input.holder.trim().length < 2) e.holder = "Who carries it?";
  if (!input.firm.trim()) e.firm = "Their company, or 'Self'.";
  if (!/^[6-9]\d{9}$/.test(input.phone.replace(/\D/g, "").slice(-10))) e.phone = "A 10-digit mobile number.";
  if (!input.tenant_id) e.tenant_id = "Which tenant is the host?";
  if (input.gate_ids.length === 0) e.gate_ids = "At least one gate.";
  if (!input.valid_from || !input.valid_to) e.valid_to = "Set the validity window.";
  else if (new Date(input.valid_to) <= new Date(input.valid_from)) e.valid_to = "Must end after it starts.";
  return e;
}
