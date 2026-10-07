import type { CampusData } from "@/lib/campus/types";
import { initials } from "@/lib/domain/format";

/**
 * A floor-plan style board of the campus: towers as blocks, gates on the boundary, each guard
 * pinned at their post. Not a map — the live map already does geography; this answers "which
 * building is uncovered" at a glance, the way a control-room whiteboard does.
 */
export function CampusRadar({ data }: { data: CampusData }) {
  const blocks: Record<string, { x: number; y: number; w: number; h: number }> = {
    "tw-a": { x: 40, y: 40, w: 200, h: 120 },
    "tw-b": { x: 300, y: 40, w: 180, h: 120 },
    "tw-c": { x: 300, y: 190, w: 180, h: 80 },
    "tw-u": { x: 40, y: 190, w: 200, h: 80 },
  };
  const gatePos: Record<string, { x: number; y: number }> = {
    "gt-1": { x: 150, y: 312 }, "gt-2": { x: 260, y: 312 }, "gt-3": { x: 496, y: 300 }, "gt-4": { x: 24, y: 300 },
  };
  const pins = data.deployments.filter((d) => !d.reserve).map((d, i) => {
    const g = d.gate_ids[0] ? gatePos[d.gate_ids[0]] : null;
    const b = d.tower_id ? blocks[d.tower_id] : null;
    const at = g ? { x: g.x, y: g.y - 26 } : b ? { x: b.x + 30 + ((i * 47) % (b.w - 60)), y: b.y + b.h - 22 - ((i % 2) * 24) } : { x: 270, y: 290 };
    return { d, ...at };
  });
  const covered = new Set(data.deployments.filter((d) => d.online && d.tower_id).map((d) => d.tower_id));

  return (
    <svg viewBox="0 0 520 330" className="h-auto w-full" role="img" aria-label="Campus board: towers, gates and guards at their posts">
      <rect x="4" y="4" width="512" height="308" rx="14" fill="var(--muted)" opacity="0.5" stroke="var(--border)" strokeDasharray="4 4" />
      {data.towers.map((t) => {
        const b = blocks[t.id];
        if (!b) return null;
        const ok = covered.has(t.id);
        return (
          <g key={t.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill="var(--card)" stroke={ok ? "var(--border)" : "var(--signal)"} strokeDasharray={ok ? undefined : "5 4"} strokeWidth={ok ? 1 : 1.5} />
            <text x={b.x + 10} y={b.y + 18} fontSize="10" fontFamily="var(--font-mono)" fill="var(--muted-foreground)">{t.code}</text>
            <text x={b.x + 10} y={b.y + 33} fontSize="12" fontWeight={600} fill="var(--foreground)">{t.name.split(" (")[0]}</text>
            {!ok && <text x={b.x + b.w - 10} y={b.y + 18} textAnchor="end" fontSize="10" fill="var(--signal)">No guard online</text>}
          </g>
        );
      })}
      {data.gates.map((g) => {
        const p = gatePos[g.id]!;
        return (
          <g key={g.id}>
            <rect x={p.x - 16} y={p.y - 7} width="32" height="14" rx="3" fill="var(--primary)" />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--primary-foreground)">{g.code}</text>
          </g>
        );
      })}
      {pins.map(({ d, x, y }) => (
        <g key={d.guard.id}>
          <title>{`${d.guard.full_name} · ${d.post} · ${d.online ? "online" : "offline"}${d.battery_pct != null ? ` · ${d.battery_pct}%` : ""}`}</title>
          <circle cx={x} cy={y} r="13" fill={d.online ? "var(--present)" : "var(--muted-foreground)"} opacity={d.online ? 0.18 : 0.15} />
          <circle cx={x} cy={y} r="10" fill="var(--card)" stroke={d.online ? "var(--present)" : "var(--muted-foreground)"} strokeWidth="2" />
          <text x={x} y={y + 3.5} textAnchor="middle" fontSize="8.5" fontWeight={700} fill="var(--foreground)">{initials(d.guard.full_name)}</text>
        </g>
      ))}
    </svg>
  );
}
