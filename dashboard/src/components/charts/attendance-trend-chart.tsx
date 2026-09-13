"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

type Row = { day: string; present: number; half_day: number; absent: number; on_leave: number; scheduled: number };

const SERIES = [
  { key: "present", label: "Present", color: "var(--present)" },
  { key: "half_day", label: "Half day", color: "var(--half-day)" },
  { key: "absent", label: "Absent", color: "var(--absent)" },
  { key: "on_leave", label: "On leave", color: "var(--on-leave)" },
] as const;

/** Stacked daily attendance for the last two weeks. */
export function AttendanceTrendChart({ data }: { data: Row[] }) {
  const rows = data.map((r) => ({ ...r, label: format(new Date(`${r.day}T00:00:00`), "d MMM") }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }} interval={1} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 5%, transparent)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-sans)", boxShadow: "0 8px 24px oklch(0 0 0 / 0.12)" }}
            labelStyle={{ fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 4 }}
            formatter={(value, name) => [value, SERIES.find((s) => s.key === name)?.label ?? String(name)]}
          />
          {SERIES.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
