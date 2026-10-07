"use client";

import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" };
const TIP = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px oklch(0 0 0 / 0.12)" },
  labelStyle: { fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 4 },
};

/** Gate footfall by hour: today as a filled area, yesterday as a dotted baseline. */
export function InflowChart({ data }: { data: { hour: string; today: number | null; yesterday: number }[] }) {
  const peak = data.reduce((m, d) => ((d.today ?? -1) > (m.today ?? -1) ? d : m), data[0]!);
  return (
    <div className="w-full" role="img" aria-label={`Visitors per hour; today peaked at ${peak?.hour ?? "—"}`}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={AXIS} interval={1} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} allowDecimals={false} />
          <Tooltip {...TIP} formatter={(v, n) => [v ?? "—", n === "today" ? "Today" : "Yesterday"]} />
          <Line type="monotone" dataKey="yesterday" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Area type="monotone" dataKey="today" stroke="var(--primary)" strokeWidth={2} fill="url(#inflow)" connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex gap-4 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> Today</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-muted-foreground" /> Yesterday</span>
      </div>
    </div>
  );
}

const SLICES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-3)", "var(--chart-5)"];

/** Today's visits split by host tenant, total in the hole. */
export function TenantDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="relative size-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="var(--card)" isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={SLICES[i % SLICES.length]} />)}
            </Pie>
            <Tooltip {...TIP} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display tabular text-3xl font-semibold">{total}</span>
          <span className="eyebrow">visits</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: SLICES[i % SLICES.length] }} />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="font-mono tabular text-xs text-muted-foreground">{total ? Math.round((100 * d.value) / total) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
