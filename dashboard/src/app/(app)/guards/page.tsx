import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listGuards, loadGuardFormOptions, type GuardListFilters } from "@/lib/data/guards";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { ButtonLink } from "@/components/gf/button-link";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { AttendanceBadge } from "@/components/gf/attendance-badge";
import { GuardFilters } from "@/components/guards/guard-filters";
import { GuardStatusBadge } from "@/components/guards/guard-status-badge";
import { KycProgressCell } from "@/components/guards/kyc-progress";
import { fmtDate, fmtPhone } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function GuardsPage({ searchParams }: PageProps<"/guards">) {
  const sp = await searchParams;
  const filters: GuardListFilters = {
    site: typeof sp.site === "string" ? sp.site : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    kyc: typeof sp.kyc === "string" ? sp.kyc : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined,
  };
  const session = await requireSession();
  const [guards, { sites }] = await Promise.all([listGuards(session, filters), loadGuardFormOptions()]);
  const anyFilterActive = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Roster"
        title="Guards"
        description="Every guard on the books — KYC completeness, deployment and last shift."
        actions={
          <ButtonLink href="/guards/new">
            <UserPlus data-icon="inline-start" /> Add guard
          </ButtonLink>
        }
      />

      <Section
        title={`${guards.length} guard${guards.length === 1 ? "" : "s"}`}
        actions={<GuardFilters sites={sites} />}
        bodyClassName="p-0"
      >
        {guards.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={anyFilterActive ? "No guards match these filters" : "No guards yet"}
            description={anyFilterActive ? "Try clearing a filter or searching a different term." : "Add your first guard to start building the roster."}
            action={!anyFilterActive && <ButtonLink href="/guards/new">Add guard</ButtonLink>}
          />
        ) : (
          <table className="w-full text-sm" aria-label="Guard roster">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th className="min-w-[220px]">Guard</th>
                <th>Site</th>
                <th>Supervisor</th>
                <th>Status</th>
                <th>KYC</th>
                <th>Phone</th>
                <th>Last shift</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {guards.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/guards/${g.id}`} className="flex items-center gap-2.5">
                      <GuardAvatar name={g.full_name} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-medium hover:underline">{g.full_name}</div>
                        <Mono className="text-muted-foreground">{g.employee_code ?? "—"}</Mono>
                        {g.designation && <div className="truncate text-xs text-muted-foreground">{g.designation}</div>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.sites?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-2.5"><GuardStatusBadge status={g.status} size="xs" /></td>
                  <td className="px-4 py-2.5"><KycProgressCell guard={g} docs={g.guard_documents} /></td>
                  <td className="px-4 py-2.5"><Mono className="whitespace-nowrap">{fmtPhone(g.phone)}</Mono></td>
                  <td className="px-4 py-2.5">
                    {g.last_shift ? (
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{fmtDate(g.last_shift.shift_date, undefined, "d MMM")}</span>
                        {g.last_shift.started_at ? (
                          <AttendanceBadge status={g.last_shift.attendance as never} size="xs" />
                        ) : (
                          <StatusPill tone="neutral" size="xs" dot={false}>Not started</StatusPill>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No shifts yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
