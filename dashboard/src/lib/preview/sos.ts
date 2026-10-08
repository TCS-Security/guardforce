import { rng } from "./rng";
import type { Crew, CrewGuard } from "./crew";

export type SosKind = "panic" | "man_down";
export type SosStatus = "active" | "acknowledged" | "resolved";

export const SOS_KIND: Record<SosKind, { label: string; hint: string }> = {
  panic: { label: "Panic button", hint: "Guard pressed and held SOS" },
  man_down: { label: "Man down", hint: "Phone detected a fall and no movement" },
};

export type SosAlert = {
  id: string;
  guard: CrewGuard;
  kind: SosKind;
  raised_at: string;
  lat: number;
  lng: number;
  status: SosStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  note: string | null;
};

const NOTES = [
  "False alarm — pressed while cleaning phone",
  "Trespasser at back gate, police informed, left before arrival",
  "Guard slipped on wet floor, first aid given",
  "Drunk visitor argued at gate, client security handled",
  "Phone fell from desk, guard fine",
  "Fire alarm panel beeping, maintenance called",
];

const BASE = { lat: 12.9716, lng: 77.5946 };

/** Two live alerts and a month of handled ones, relative to `now`. */
export function generateSos(crew: Crew, now: Date): { alerts: SosAlert[] } {
  const r = rng(`sos:${crew.today}`);
  const alerts: SosAlert[] = [];
  const guards = crew.guards;
  if (guards.length === 0) return { alerts };
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();
  const pos = () => ({ lat: BASE.lat + (r.next() - 0.5) * 0.15, lng: BASE.lng + (r.next() - 0.5) * 0.15 });

  alerts.push({ id: "sos-live-1", guard: r.pick(guards), kind: "panic", raised_at: at(3), ...pos(), status: "active", acknowledged_by: null, acknowledged_at: null, resolved_at: null, note: null });
  alerts.push({ id: "sos-live-2", guard: r.pick(guards), kind: "man_down", raised_at: at(14), ...pos(), status: "acknowledged", acknowledged_by: "Priya (supervisor)", acknowledged_at: at(12), resolved_at: null, note: null });

  for (let i = 0; i < 14; i++) {
    const mins = r.int(60 * 6, 60 * 24 * 30);
    const ack = r.int(1, 9);
    alerts.push({
      id: `sos-${i}`,
      guard: r.pick(guards),
      kind: r.pick<SosKind>(["panic", "panic", "panic", "man_down"]),
      raised_at: at(mins),
      ...pos(),
      status: "resolved",
      acknowledged_by: r.pick(["Priya (supervisor)", "Arun (supervisor)", "Control room"]),
      acknowledged_at: at(mins - ack),
      resolved_at: at(mins - ack - r.int(5, 50)),
      note: r.pick(NOTES),
    });
  }

  return { alerts };
}

/** Seconds from raise to first acknowledgement, for alerts that have one. */
export function ackSeconds(a: SosAlert): number | null {
  return a.acknowledged_at ? Math.round((new Date(a.acknowledged_at).getTime() - new Date(a.raised_at).getTime()) / 1000) : null;
}
