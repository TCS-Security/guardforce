import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { loadTenant } from "@/lib/data/platform";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { FormAlert } from "@/components/gf/form-alert";
import { TENANT_STATUS } from "@/components/platform/tenant-status";
import { TenantControls } from "@/components/platform/tenant-controls";
import { MemberPasswordReset } from "@/components/platform/member-password-reset";
import { fmtDate, fmtDateTime } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/platform/tenants/[id]">): Promise<Metadata> {
  const { db } = await requirePlatformAdmin();
  const { id } = await params;
  const t = await loadTenant(db, id);
  return { title: t ? `${t.agency.name} · Platform` : "Tenant" };
}

export default async function TenantPage({ params, searchParams }: PageProps<"/platform/tenants/[id]">) {
  const { db } = await requirePlatformAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadTenant(db, id);
  if (!data) notFound();
  const { agency, members, sites, guards, shifts30, audit } = data;
  const status = TENANT_STATUS[agency.status];
  const freshOwner = typeof sp.owner === "string" ? sp.owner : null;
  const freshPassword = typeof sp.password === "string" ? sp.password : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<><Link href="/platform" className="hover:text-foreground">Tenants</Link> · {agency.slug}</>}
        title={agency.name}
        description={[agency.city, `${agency.plan} plan`, `since ${fmtDate(agency.created_at)}`].filter(Boolean).join(" · ")}
        actions={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
      />

      {freshOwner && freshPassword && (
        <FormAlert tone="success">
          <div className="flex flex-col gap-1">
            <span>Tenant created. Hand these to the owner; this password is shown once.</span>
            <Mono>{freshOwner} · {freshPassword}</Mono>
          </div>
        </FormAlert>
      )}

      {(agency.status === "suspended" || agency.status === "churned") && (
        <FormAlert tone="warning">
          {status.label} since {fmtDateTime(agency.suspended_at)}: {agency.suspended_reason ?? "no reason recorded"}. Members see a lock-out screen; nothing has been deleted.
        </FormAlert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Guards" value={guards} hint={agency.max_guards ? `cap ${agency.max_guards}` : "no seat cap"} tone={agency.max_guards && guards > agency.max_guards ? "signal" : "neutral"} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Sites" value={sites.filter((s) => s.is_active).length} hint={`${sites.length} total`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Dashboard logins" value={members.length} hint={`${members.filter((m) => m.role === "owner").length} owner${members.filter((m) => m.role === "owner").length === 1 ? "" : "s"}`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Shifts, 30 days" value={shifts30} hint={shifts30 === 0 ? "Not using it yet" : "rostered or worked"} tone={shifts30 === 0 && agency.status === "active" ? "half-day" : "neutral"} style={{ ["--i" as string]: 4 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Section title="Dashboard logins" bodyClassName="p-0" style={{ ["--i" as string]: 5 }}>
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <GuardAvatar name={m.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.full_name}</div>
                    <Mono className="text-muted-foreground">{m.email}</Mono>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner" : (m.role_name ?? "No role")}{m.all_sites || m.role === "owner" ? "" : " · scoped"}</span>
                  {!m.is_active && <StatusPill tone="neutral" size="xs" dot={false}>disabled</StatusPill>}
                  <MemberPasswordReset profileId={m.id} agencyId={agency.id} name={m.full_name} />
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Sites (${sites.length})`} bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
            {sites.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No sites yet.</p>
            ) : (
              <ul className="divide-y">
                {sites.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <Mono className="text-muted-foreground">{s.guards_required} posts</Mono>
                    {!s.is_active && <StatusPill tone="neutral" size="xs" dot={false}>inactive</StatusPill>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <TenantControls agency={agency} />

          <Section title="Platform history" bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
            {audit.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y">
                {audit.map((a) => (
                  <li key={a.id} className="px-4 py-2">
                    <div className="text-[13px] font-medium">{a.action.replace(/_/g, " ")}</div>
                    {a.reason && <p className="text-xs text-muted-foreground">“{a.reason}”</p>}
                    <Mono className="text-[11px] text-muted-foreground">
                      {a.platform_actor_id ? "platform" : ((a.profiles as { full_name?: string } | null)?.full_name ?? "system")} · {fmtDateTime(a.created_at)}
                    </Mono>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
