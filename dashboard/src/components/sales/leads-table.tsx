import Link from "next/link";
import { Phone, Users } from "lucide-react";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { fmtDate } from "@/lib/domain/format";
import { STAGES, type Reason } from "@/lib/domain/sales";
import type { LeadRow, SalesTab } from "@/lib/data/sales";
import { LabelPill, SOFTWARE_TEXT, bestPhone, segmentLabel } from "./bits";

export function LeadsTable({ rows, base, tab, today, timezone }: { rows: LeadRow[]; base: string; tab: SalesTab; today: string; timezone: string }) {
  const href = (id: string) => `/sales?${base ? `${base}&` : ""}lead=${id}`;
  const title =
    tab === "today"
      ? `${rows.length} follow-up${rows.length === 1 ? "" : "s"} due`
      : `${rows.length} lead${rows.length === 1 ? "" : "s"}`;

  return (
    <Section title={title} bodyClassName="p-0" style={{ ["--i" as string]: 4 }}>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={tab === "today" ? "Nothing due today" : "No leads here yet"}
          description={tab === "today" ? "Follow-ups you set on a lead show up here on the day." : "Open “Find new leads” to add places near you, or add one by hand."}
          className="border-0"
          action={tab === "today" ? undefined : <Link href="/sales?tab=find" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Find new leads →</Link>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm" aria-label="Leads">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Lead</th>
                <th>Why</th>
                <th>Current agency</th>
                <th>Phone</th>
                <th>Owner</th>
                <th>Follow-up</th>
                <th className="text-right">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((l) => {
                const reasons = (Array.isArray(l.reasons) ? l.reasons : []) as Reason[];
                const why = reasons.find((r) => r.kind !== "size") ?? reasons[0];
                const phone = bestPhone(l.lead_numbers);
                const overdue = l.next_follow_up && l.next_follow_up < today && !["won", "lost"].includes(l.stage);
                const sw = l.incumbent_software ? SOFTWARE_TEXT[l.incumbent_software] : null;
                return (
                  <tr key={l.id} className="group hover:bg-muted/40" data-lead={l.name}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <LabelPill label={l.label as "hot" | "warm" | "cold"} size="xs" />
                        <Link href={href(l.id)} scroll={false} className="font-medium hover:underline">{l.name}</Link>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {segmentLabel(l.segment)}
                        {l.locality ? ` · ${l.locality}` : ""}
                      </div>
                    </td>
                    <td className="max-w-[300px] px-4 py-2.5 text-muted-foreground">
                      <span className="line-clamp-2">{why?.text ?? "Not much known yet"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {l.incumbent_agency ? (
                        <div>
                          <div className="truncate">{l.incumbent_agency}</div>
                          {sw && <div className="text-xs text-muted-foreground">{sw.text}</div>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not known</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {phone ? (
                        <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-mono text-xs hover:underline">
                          <Phone className="size-3" /> {phone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.owner?.full_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {l.next_follow_up ? (
                        <Mono className={overdue ? "text-absent" : "text-muted-foreground"}>
                          {l.next_follow_up === today ? "Today" : fmtDate(`${l.next_follow_up}T12:00:00+05:30`, timezone, "d MMM")}
                        </Mono>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <StatusPill tone={l.stage === "won" ? "present" : l.stage === "lost" ? "neutral" : "olive"} size="xs" dot={false}>
                        {STAGES.find((s) => s.key === l.stage)?.label}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
