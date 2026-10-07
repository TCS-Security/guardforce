import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { dailyTotals, generateDistance } from "@/lib/preview/distance";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { StatTile } from "@/components/gf/stat-tile";
import { Section } from "@/components/gf/section";
import { DataTable, type DataTableColumn } from "@/components/gf/data-table";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { ButtonLink } from "@/components/gf/button-link";
import { fmtDate, fmtDistance, fmtMinutes } from "@/lib/domain/format";
import type { DistanceRow } from "@/lib/preview/distance";
import { ArrowLeft } from "lucide-react";
import { cn } from "cn";

export const dynamic = "force-dynamic";

const day = (d: string, pattern: string) => fmtDate(`${d}T12:00:00+05:30`, undefined, pattern);

export default async function DistanceReportPage() {
  const session = await requireSession();
  requirePermission(session, "reports:read");
  const crew = await loadPreviewCrew(session);
  const rows = generateDistance(crew);
  const totals = dailyTotals(rows);
  const yesterday = totals.at(-1);
  const onDutyYesterday = rows.filter((r) => r.days.at(-1)?.on_duty).length;
  const top = rows[0];
  const outside = rows.filter((r) => r.outside_min > 60).length;
  const maxDay = Math.max(1, ...totals.map((t) => t.metres));

  const columns: DataTableColumn<DistanceRow>[] = [
    {
      key: "guard", header: "Guard", pin: true, width: 210,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <GuardAvatar name={r.guard.full_name} size="xs" />
          <span className="truncate font-medium">{r.guard.full_name}</span>
        </div>
      ),
    },
    { key: "site", header: "Site", cell: (r) => <span className="text-xs text-muted-foreground">{r.guard.site_name ?? "—"}</span> },
    ...(rows[0]?.days ?? []).map((d, i): DataTableColumn<DistanceRow> => ({
      key: d.date,
      header: day(d.date, "EEE d"),
      align: "right",
      cell: (r) => {
        const x = r.days[i]!;
        return x.on_duty
          ? <Mono className={cn("text-xs", x.outside_min > 30 && "text-half-day-foreground dark:text-half-day")}>{(x.metres / 1000).toFixed(1)}</Mono>
          : <span className="text-xs text-muted-foreground">off</span>;
      },
    })),
    { key: "total", header: "Week, km", align: "right", cell: (r) => <Mono className="font-semibold">{(r.total_m / 1000).toFixed(1)}</Mono> },
    { key: "outside", header: "Outside fence", align: "right", cell: (r) => <Mono className={cn("text-xs", r.outside_min > 60 && "text-signal")}>{r.outside_min ? fmtMinutes(r.outside_min) : "—"}</Mono> },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Report · Distance</>}
        title="Distance travelled"
        description="Kilometres walked or ridden per guard per day, from the location trail, and how long each spent outside the site fence."
        actions={<ButtonLink variant="ghost" href="/reports"><ArrowLeft data-icon="inline-start" /> Reports</ButtonLink>}
      />
      <PreviewBanner>The pings and fence events behind this exist already; the daily rollup is what’s still sample.</PreviewBanner>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Yesterday, all guards" value={fmtDistance(yesterday?.metres ?? 0)} hint={`${onDutyYesterday} guards on duty`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Average per shift" value={fmtDistance(onDutyYesterday ? (yesterday?.metres ?? 0) / onDutyYesterday : 0)} hint="yesterday" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Most travelled" value={top ? fmtDistance(top.total_m) : "—"} hint={top ? `${top.guard.full_name}, this week` : "nobody yet"} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Over 1h outside fence" value={outside} tone={outside ? "half-day" : "neutral"} hint="this week — check the trail" style={{ ["--i" as string]: 4 }} />
      </div>

      <Section title="All guards, per day" description="Kilometres; amber when more than 30 min was spent outside the fence" style={{ ["--i" as string]: 5 }}>
        <div className="flex h-28 items-end gap-3" role="img" aria-label="Total distance per day">
          {totals.map((t) => (
            <div key={t.date} className="flex flex-1 flex-col items-center gap-1.5">
              <Mono className="text-[11px] text-muted-foreground">{(t.metres / 1000).toFixed(0)}</Mono>
              <div className="w-full rounded-sm bg-primary/80" style={{ height: `${(t.metres / maxDay) * 72}px` }} />
              <Mono className="text-[10px] text-muted-foreground">{day(t.date, "EEE")}</Mono>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Per guard" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.guard.id} ariaLabel="Distance per guard per day" />
      </Section>
    </div>
  );
}
