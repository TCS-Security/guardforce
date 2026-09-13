import type { PatrolTally } from "@/lib/domain/patrols";

const SEGMENTS = [
  { key: "completed", color: "var(--present)", label: "on time" },
  { key: "late", color: "var(--half-day)", label: "late" },
  { key: "missed", color: "var(--absent)", label: "missed" },
  { key: "in_progress", color: "var(--primary)", label: "walking" },
  { key: "scheduled", color: "var(--muted)", label: "due" },
] as const;

/** Single-bar breakdown of a site's rounds for the day. */
export function ComplianceBar({ tally }: { tally: PatrolTally }) {
  const total = SEGMENTS.reduce((a, s) => a + tally[s.key], 0);
  if (total === 0) return null;
  const summary = SEGMENTS.filter((s) => tally[s.key] > 0).map((s) => `${tally[s.key]} ${s.label}`).join(", ");
  return (
    <span className="flex h-2 w-40 overflow-hidden rounded-full bg-muted" role="img" aria-label={summary} title={summary}>
      {SEGMENTS.map((s) =>
        tally[s.key] > 0 ? (
          <span key={s.key} style={{ width: `${(100 * tally[s.key]) / total}%`, background: s.color }} />
        ) : null,
      )}
    </span>
  );
}
