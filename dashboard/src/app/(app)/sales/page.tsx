import type { Metadata } from "next";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadLead, loadLeads, loadProspects, type SalesFilters, type SalesTab } from "@/lib/data/sales";
import { PageHeader } from "@/components/gf/page-header";
import { StatTile } from "@/components/gf/stat-tile";
import { SalesToolbar } from "@/components/sales/sales-toolbar";
import { LeadsTable } from "@/components/sales/leads-table";
import { LeadsBoard } from "@/components/sales/leads-board";
import { FindLeads } from "@/components/sales/find-leads";
import { LeadCard } from "@/components/sales/lead-card";
import { NewLeadDialog } from "@/components/sales/new-lead-dialog";
import { SEGMENTS, type Label, type Segment, type Stage } from "@/lib/domain/sales";

export const metadata: Metadata = { title: "Sales leads" };
export const dynamic = "force-dynamic";

const LABELS = ["hot", "warm", "cold"] as const;
const STAGES = ["new", "called", "meeting", "proposal", "won", "lost"] as const;

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const session = await requireSession();
  requirePermission(session, "sales:read");
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v !== "all" ? v : null);

  const tab: SalesTab = sp.tab === "today" ? "today" : sp.tab === "find" ? "find" : "leads";
  const view = sp.view === "board" ? "board" : "list";
  const label = str(sp.label);
  const segment = str(sp.segment);
  const stage = str(sp.stage);
  const filters: SalesFilters = {
    label: label && (LABELS as readonly string[]).includes(label) ? (label as Label) : null,
    segment: segment && segment in SEGMENTS ? (segment as Segment) : null,
    stage: stage && (STAGES as readonly string[]).includes(stage) ? (stage as Stage) : null,
    owner: str(sp.owner),
    q: str(sp.q),
  };
  const near = sp.near === "1";
  const leadId = str(sp.lead);

  const [leads, prospects, detail] = await Promise.all([
    loadLeads(session, filters, tab === "find" ? "leads" : tab),
    tab === "find" ? loadProspects({ ...filters, near }) : Promise.resolve(null),
    leadId ? loadLead(session, leadId) : Promise.resolve(null),
  ]);

  // Links that open a lead keep every other filter, so closing the card lands where you were.
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "lead") baseParams.set(k, v);
  const base = baseParams.toString();

  const canWrite = session.can("sales:write");

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      <PageHeader
        eyebrow="Sell"
        title="Sales leads"
        description="Places near you that need guards. Hot ones first: call them, note what happened, set the next follow-up."
        actions={canWrite ? <NewLeadDialog /> : null}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Follow-ups due" value={leads.counts.due} tone={leads.counts.due > 0 ? "signal" : "neutral"} href="/sales?tab=today" style={{ ["--i" as string]: 1 }} />
        <StatTile label="Hot leads" value={leads.counts.hot} tone="signal" href="/sales?label=hot" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Open leads" value={leads.counts.open} href="/sales" style={{ ["--i" as string]: 3 }} />
      </div>

      <SalesToolbar tab={tab} view={view} filters={filters} near={near} team={leads.team} />

      {tab === "find" && prospects ? (
        <FindLeads rows={prospects.rows} hasSites={prospects.hasSites} canWrite={canWrite} />
      ) : view === "board" && tab === "leads" ? (
        <LeadsBoard rows={leads.rows} base={base} canWrite={canWrite} today={leads.today} />
      ) : (
        <LeadsTable rows={leads.rows} base={base} tab={tab} today={leads.today} timezone={session.agency.timezone} />
      )}

      {detail && (
        <LeadCard
          key={detail.lead.id}
          detail={detail}
          team={leads.team}
          closeHref={base ? `/sales?${base}` : "/sales"}
          canWrite={canWrite}
          canLookup={session.can("sales:lookup")}
          canMakeSite={session.can("sites:write")}
          timezone={session.agency.timezone}
        />
      )}
    </div>
  );
}
