import type { ChecklistItem, Floor, FloorInspection, InspectionState } from "./types";
import type { Tone } from "@/lib/domain/status";

/**
 * The daily floor survey. Four proofs in a fixed order (each step only opens when the one
 * before it passed): scan the floor's QR, stand inside its fence, take a live photo, answer
 * the checklist. A failing answer needs a photo of the problem and turns into a task for
 * whoever owns that kind of fault, plus a WhatsApp to them — the part a paper register and
 * most apps stop short of.
 */

export const INSPECTION_STATE: Record<InspectionState, { label: string; tone: Tone }> = {
  completed: { label: "Completed", tone: "present" },
  pending_approval: { label: "Awaiting sign-off", tone: "half-day" },
  missed: { label: "Missed", tone: "absent" },
  due: { label: "Due", tone: "neutral" },
};

export const SURVEY_STEPS = [
  { key: "qr", label: "QR scan", hint: "Scan the code fixed at the floor checkpoint" },
  { key: "gps", label: "Geofence", hint: "Phone must be inside the floor's radius" },
  { key: "photo", label: "Live photo", hint: "Camera only, stamped with guard, time and place" },
  { key: "checklist", label: "Checklist", hint: "Every question; a fail needs a photo" },
] as const;

export type SurveyStep = (typeof SURVEY_STEPS)[number]["key"];

export const OWNER_LABEL: Record<ChecklistItem["owner"], string> = {
  facility: "Facility manager",
  security: "Security supervisor",
  electrical: "Electrical maintenance",
  housekeeping: "Housekeeping lead",
};

export type FailAction = { item: ChecklistItem; task: string; notify: string; needsPhoto: boolean; hasPhoto: boolean };

/** What submitting these answers will set in motion, one entry per failed question. */
export function failActions(checklist: ChecklistItem[], answers: Record<string, boolean>, photos: Record<string, boolean>, floorName: string): FailAction[] {
  return checklist
    .filter((c) => answers[c.id] === false)
    .map((c) => ({
      item: c,
      task: `${c.fail_label}: ${c.question.toLowerCase()} — ${floorName}`,
      notify: OWNER_LABEL[c.owner],
      needsPhoto: c.photo_on_fail,
      hasPhoto: !!photos[c.id],
    }));
}

/** Why the survey cannot be submitted yet, or null when it can. */
export function submitBlocker(checklist: ChecklistItem[], answers: Record<string, boolean>, photos: Record<string, boolean>): string | null {
  const unanswered = checklist.filter((c) => c.required && answers[c.id] === undefined);
  if (unanswered.length) return `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered.`;
  const missing = checklist.filter((c) => answers[c.id] === false && c.photo_on_fail && !photos[c.id]);
  if (missing.length) return `Add a photo for ${missing.map((c) => c.code).join(", ")} — a failed check needs evidence.`;
  return null;
}

export function score(checklist: ChecklistItem[], answers: Record<string, boolean>) {
  const ok = checklist.filter((c) => answers[c.id] === true).length;
  return { ok, total: checklist.length, label: `${ok}/${checklist.length} OK` };
}

/** Today's state per floor: the latest survey today if there is one, else due or missed by the cut-off. */
export function floorStates(floors: Floor[], inspections: FloorInspection[], today: string, now: Date, cutoffHour = 18, tz = "Asia/Kolkata") {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(now));
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return floors.map((f) => {
    const mine = inspections.filter((i) => i.floor_id === f.id).sort((a, b) => b.finished_at.localeCompare(a.finished_at));
    const todays = mine.find((i) => dayOf(i.finished_at) === today);
    const state: InspectionState = todays ? todays.state : hour >= cutoffHour ? "missed" : "due";
    return { floor: f, state, latest: todays ?? null, last: mine[0] ?? null };
  });
}

/**
 * A survey is clean when every question it was asked passed. Judged against its own answers,
 * not today's checklist, so adding a question later does not turn the whole history into faults.
 */
export function ledgerStats(inspections: FloorInspection[]) {
  const total = inspections.length;
  const clean = inspections.filter((i) => Object.values(i.answers).every(Boolean)).length;
  const flagged = total - clean;
  const durations = inspections.map((i) => (new Date(i.finished_at).getTime() - new Date(i.started_at).getTime()) / 60_000);
  const gps = inspections.filter((i) => i.gps_ok).length;
  return {
    total,
    clean,
    flagged,
    compliance: total ? Math.round((100 * clean) / total) : null,
    avgMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    gpsPct: total ? Math.round((100 * gps) / total) : null,
  };
}
