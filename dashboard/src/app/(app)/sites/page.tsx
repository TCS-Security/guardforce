import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadSites } from "@/lib/data/sites";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { SitesFilters } from "./filters";
import { fenceLabel } from "@/lib/domain/sites";
import { cn } from "cn";

export const metadata: Metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

export default async function SitesPage({ searchParams }: PageProps<"/sites">) {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase().trim() : "";
  const showInactive = sp.inactive === "1";

  const all = await loadSites(session, { includeInactive: true });
  const sites = all.filter((s) => {
    if (!showInactive && !s.is_active) return false;
    if (!q) return true;
    return [s.name, s.client_name, s.city, s.address].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
  });

  const totalRequired = sites.reduce((a, s) => a + s.guards_required, 0);
  const totalOnDuty = sites.reduce((a, s) => a + s.on_duty_now, 0);
  const inactiveCount = all.filter((s) => !s.is_active).length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={`${all.filter((s) => s.is_active).length} active · ${totalOnDuty}/${totalRequired} posts covered now`}
        title="Sites"
        description="Each site carries its own perimeter, leeway buffer, staffing level and shift pattern."
        actions={
          session.can("sites:write") ? (
            <ButtonLink href="/sites/new">
              <Plus data-icon="inline-start" /> New site
            </ButtonLink>
          ) : null
        }
      />

      <SitesFilters q={q} showInactive={showInactive} inactiveCount={inactiveCount} />

      {sites.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title={q ? "No sites match that search" : "No sites yet"}
          description={q ? "Try the client name or the area instead." : "Add the first client site to start rostering guards against it."}
          action={session.can("sites:write") && !q ? <ButtonLink href="/sites/new"><Plus data-icon="inline-start" /> New site</ButtonLink> : null}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s, i) => {
            const gap = Math.max(0, s.guards_required - s.on_duty_now);
            return (
              <Section
                key={s.id}
                className={cn("reveal", !s.is_active && "opacity-70")}
                style={{ ["--i" as string]: i }}
                bodyClassName="p-0"
              >
                <Link href={`/sites/${s.id}`} className="block p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[15px] leading-tight font-semibold tracking-tight">{s.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {s.client_name ?? "No client on record"}{s.city ? ` · ${s.city}` : ""}
                      </p>
                    </div>
                    {s.is_active ? (
                      gap > 0 ? <StatusPill tone="signal" size="xs">{gap} short</StatusPill> : <StatusPill tone="present" size="xs" dot={false}>Covered</StatusPill>
                    ) : (
                      <StatusPill tone="neutral" size="xs" dot={false}>Inactive</StatusPill>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                    <Metric label="On duty" value={`${s.on_duty_now}/${s.guards_required}`} tone={gap > 0 ? "signal" : "present"} />
                    <Metric label="On roll" value={s.guards_count} />
                    <Metric label="Flags today" value={s.flagged} tone={s.flagged > 0 ? "half-day" : "neutral"} />
                  </dl>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{fenceLabel(s)}</span>
                    <div className="flex -space-x-1.5">
                      {s.supervisors.slice(0, 3).map((sup) => (
                        <GuardAvatar key={sup.id} name={sup.full_name} size="xs" className="ring-2 ring-card" />
                      ))}
                    </div>
                  </div>
                </Link>
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "present" | "signal" | "half-day" }) {
  const color = { neutral: "text-foreground", present: "text-present", signal: "text-signal", "half-day": "text-half-day-foreground dark:text-half-day" }[tone];
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("font-display tabular text-lg leading-none font-semibold", color)}>{value}</dd>
    </div>
  );
}
