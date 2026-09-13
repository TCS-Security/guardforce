import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadAuditLogFacets, loadAuditLogs } from "@/lib/data/settings";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { fmtDateTime } from "@/lib/domain/format";
import { AuditFilters } from "./audit-filters";
import { AuditRow } from "./audit-row";

export const metadata: Metadata = { title: "Audit log · Settings" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  const session = await requireSession();
  if (!session.isManager) notFound();
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

  const filters = { entityType: str(sp.entity), actorId: str(sp.actor), from: str(sp.from), to: str(sp.to) };
  const [rows, facets] = await Promise.all([loadAuditLogs(filters), loadAuditLogFacets()]);

  return (
    <div className="flex flex-col gap-4">
      <AuditFilters entityTypes={facets.entityTypes} actors={facets.actors} current={filters} />
      <Section
        title="Audit trail"
        description="Every attendance override, exception and settings change — who, when and why. Append-only."
        bodyClassName="p-0"
        style={{ ["--i" as string]: 2 }}
      >
        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="Nothing logged for this filter" description="Overrides, exceptions and settings changes appear here." className="border-0" />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <AuditRow
                key={r.id}
                row={{
                  ...r,
                  when: fmtDateTime(r.created_at, session.agency.timezone),
                }}
              />
            ))}
          </ul>
        )}
      </Section>
      {rows.length >= 200 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing the most recent 200 entries. <Mono>Narrow the date range to see older ones.</Mono>
        </p>
      )}
    </div>
  );
}
