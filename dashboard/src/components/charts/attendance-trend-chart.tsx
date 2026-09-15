"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

type Row = { day: string; present: number; half_day: number; absent: number; on_leave: number; scheduled: number };

const SERIES = [
  { key: "present", label: "Present", color: "var(--present)" },
  { key: "half_day", label: "Half day", color: "var(--half-day)" },
  { key: "absent", label: "Absent", color: "var(--absent)" },
  { key: "on_leave", label: "On leave", color: "var(--on-leave)" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

/**
 * Where a bar (or one of its segments) leads: the attendance day view, filtered to the
 * status that was clicked, so "who was absent on the 4th" is one click rather than a
 * date picker and a dropdown. `status` values match the `?status=` filter the page reads.
 */
export function trendHref(day: string, status?: SeriesKey, siteId?: string | null) {
  const params = new URLSearchParams({ date: day });
  if (status) params.set("status", status);
  if (siteId) params.set("site", siteId);
  return `/attendance?${params.toString()}`;
}

/** Stacked daily attendance for the last two weeks. Every bar drills into its day. */
export function AttendanceTrendChart({ data, siteId }: { data: Row[]; siteId?: string | null }) {
  const router = useRouter();
  const rows = data.map((r) => ({ ...r, label: format(new Date(`${r.day}T00:00:00`), "d MMM") }));

  function open(day: string | undefined, status?: SeriesKey) {
    if (!day) return;
    router.push(trendHref(day, status, siteId));
  }

  return (
    // The legend sits below the plot, so the fixed height belongs to the plot alone.
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={rows}
          margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
          barCategoryGap={6}
          // Clicking anywhere in a column opens that day, even the gap above the bar.
          // recharts hands back the active tick index, not the row.
          onClick={(state) => open(rows[Number(state?.activeIndex)]?.day)}
          className="cursor-pointer"
        >
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
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0}
              maxBarSize={26}
              isAnimationActive={false}
              cursor="pointer"
              // A segment is more specific than the column, so it filters to that status —
              // and must not let the chart's own handler re-open the day unfiltered.
              onClick={(_, index, event) => {
                event?.stopPropagation();
                open(rows[index]?.day, s.key);
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="ml-auto">Click a bar for that day&rsquo;s guards</span>
      </div>

      {/*
        recharts bars take a mouse, not a tab stop. These links carry the same destinations
        for keyboard and screen-reader users. They are labelled rather than filled with text,
        so the chart's numbers are not duplicated into the page's text content.
      */}
      <ul className="sr-only">
        {rows.map((r) => (
          <li key={r.day}>
            <Link
              href={trendHref(r.day, undefined, siteId)}
              data-testid={`trend-day-${r.day}`}
              aria-label={`${r.label}: ${r.present} present, ${r.half_day} half day, ${r.absent} absent, ${r.on_leave} on leave. Open this day.`}
            />
            <ul>
              {SERIES.map((s) => (
                <li key={s.key}>
                  <Link
                    href={trendHref(r.day, s.key, siteId)}
                    data-testid={`trend-${s.key}-${r.day}`}
                    aria-label={`${r.label}: ${r[s.key]} ${s.label.toLowerCase()}. Open these guards.`}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

    </div>
  );
}
