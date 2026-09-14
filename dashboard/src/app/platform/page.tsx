import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { loadTenants } from "@/lib/data/platform";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { Mono } from "@/components/gf/mono";
import { fmtAgo, fmtDate } from "@/lib/domain/format";
import { TENANT_STATUS } from "@/components/platform/tenant-status";

export const metadata: Metadata = { title: "Tenants · Platform" };
export const dynamic = "force-dynamic";

export default async function PlatformHome() {
  const { db } = await requirePlatformAdmin();
  const tenants = await loadTenants(db);

  const live = tenants.filter((t) => t.status === "active").length;
  const trial = tenants.filter((t) => t.status === "trial").length;
  const suspended = tenants.filter((t) => t.status === "suspended").length;
  const seats = tenants.reduce((a, t) => a + t.guards, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="GuardForce · provider"
        title="Tenants"
        description="Every agency on the platform, its plan, its size and whether anyone is using it."
        actions={<ButtonLink href="/platform/tenants/new"><Plus data-icon="inline-start" /> New tenant</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active" value={live} tone="present" style={{ ["--i" as string]: 1 }} />
        <StatTile label="On trial" value={trial} tone={trial ? "half-day" : "neutral"} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Suspended" value={suspended} tone={suspended ? "absent" : "neutral"} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Guards on platform" value={seats} hint="active guard records across tenants" style={{ ["--i" as string]: 4 }} />
      </div>

      <Section title="All tenants" bodyClassName="p-0" style={{ ["--i" as string]: 5 }}>
        {tenants.length === 0 ? (
          <EmptyState icon={<Building2 />} title="No tenants yet" description="Onboard the first agency." className="border-0" />
        ) : (
          <table className="w-full text-sm" aria-label="Tenants">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Agency</th>
                <th>Status</th>
                <th>Plan</th>
                <th className="text-right">Guards</th>
                <th className="text-right">Sites</th>
                <th className="text-right">Logins</th>
                <th>Last activity</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/platform/tenants/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                    <Mono className="block text-muted-foreground">{t.slug}{t.city ? ` · ${t.city}` : ""}</Mono>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill tone={TENANT_STATUS[t.status].tone} size="xs">{TENANT_STATUS[t.status].label}</StatusPill></td>
                  <td className="px-4 py-2.5 capitalize text-muted-foreground">{t.plan}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Mono>{t.guards}{t.max_guards ? <span className="text-muted-foreground">/{t.max_guards}</span> : ""}</Mono>
                  </td>
                  <td className="px-4 py-2.5 text-right"><Mono>{t.sites}</Mono></td>
                  <td className="px-4 py-2.5 text-right"><Mono>{t.members}</Mono></td>
                  <td className="px-4 py-2.5"><Mono className="text-muted-foreground">{t.last_activity ? fmtAgo(t.last_activity) : "never"}</Mono></td>
                  <td className="px-4 py-2.5"><Mono className="text-muted-foreground">{fmtDate(t.created_at)}</Mono></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
