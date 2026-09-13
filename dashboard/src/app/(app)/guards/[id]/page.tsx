import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { loadGuard, loadGuardFormOptions, siteOrigin } from "@/lib/data/guards";
import { kycGaps, kycComplete } from "@/lib/domain/kyc";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { StatTile } from "@/components/gf/stat-tile";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { AttendanceBadge, ShiftStatusBadge, TrustBadge } from "@/components/gf/attendance-badge";
import { GuardStatusBadge } from "@/components/guards/guard-status-badge";
import { KycGapNotice } from "@/components/guards/kyc-progress";
import { fmtDate, fmtMinutes, fmtPct } from "@/lib/domain/format";
import { InvitePanel } from "./invite-panel";
import { KycVault } from "./kyc-vault";
import { ProfileSection } from "./profile-section";
import { SharePanel } from "./share-panel";
import { LifecyclePanel } from "./lifecycle-panel";

export const metadata: Metadata = { title: "Guard profile" };
export const dynamic = "force-dynamic";

export default async function GuardProfilePage({ params }: PageProps<"/guards/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const [detail, { sites, supervisors }, origin] = await Promise.all([
    loadGuard(session, id),
    loadGuardFormOptions(),
    siteOrigin(),
  ]);
  if (!detail) notFound();

  const { guard, documents, uploaders, shares, invite, scorecard, shifts, leave, accessLogs, selfieUrl } = detail;
  const gaps = kycGaps(guard, documents);
  const complete = kycComplete(guard, documents);
  const uploaderNames = Object.fromEntries(uploaders);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="reveal flex items-center gap-4">
        <GuardAvatar name={guard.full_name} src={selfieUrl} size="lg" />
        <PageHeader
          className="flex-1"
          eyebrow={<Link href="/guards" className="hover:underline">Roster</Link>}
          title={guard.full_name}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Mono>{guard.employee_code ?? "—"}</Mono>
              <span>{guard.designation || "No designation set"}</span>
              <span>·</span>
              <span>{guard.sites?.name ?? "No site assigned"}</span>
              <GuardStatusBadge status={guard.status} size="xs" />
              {complete ? (
                <span className="text-xs text-present">KYC complete</span>
              ) : (
                <span className="text-xs text-signal">{gaps.length} KYC item{gaps.length === 1 ? "" : "s"} missing</span>
              )}
            </span>
          }
        />
      </div>

      {guard.status === "invited" && (
        <InvitePanel guardId={guard.id} guardName={guard.full_name} agencyName={session.agency.name} phone={guard.phone} invite={invite} />
      )}

      <Section title="KYC vault" description="Typed document slots required before this guard can be rostered.">
        <div className="flex flex-col gap-3">
          <KycGapNotice gaps={gaps} />
          <KycVault guardId={guard.id} docs={documents} uploaders={uploaderNames} />
        </div>
      </Section>

      <Section title="Profile & phone">
        <ProfileSection guard={guard} sites={sites} supervisors={supervisors} selfieUrl={selfieUrl} />
      </Section>

      <Section title="Scorecard" description="Last 30 days">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Shifts" value={scorecard.shifts ?? 0} />
          <StatTile label="Punctuality" value={fmtPct(scorecard.punctuality_pct)} />
          <StatTile label="Worked hours" value={scorecard.worked_hours ?? 0} />
          <StatTile label="Flagged" value={scorecard.flagged ?? 0} tone={scorecard.flagged ? "half-day" : "neutral"} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Patrols" value={scorecard.patrols ?? 0} hint={`${scorecard.missed_patrols ?? 0} missed`} />
          <StatTile label="Avg away" value={fmtMinutes(scorecard.avg_away_min)} />
          <StatTile label="Void shifts" value={scorecard.void ?? 0} tone={scorecard.void ? "absent" : "neutral"} />
          <StatTile label="On leave" value={scorecard.on_leave ?? 0} />
        </div>

        <h3 className="mt-6 mb-2 font-display text-sm font-semibold">Recent shifts</h3>
        {shifts.length === 0 ? (
          <EmptyState title="No shifts yet" className="py-8" />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
                  <th>Date</th><th>Site</th><th>In / Out</th><th>Attendance</th><th>Trust</th><th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{fmtDate(s.shift_date)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.sites?.name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono tabular text-xs">
                      {s.started_at ? new Date(s.started_at).toISOString().slice(11, 16) : "—"} / {s.ended_at ? new Date(s.ended_at).toISOString().slice(11, 16) : "—"}
                    </td>
                    <td className="px-3 py-2"><AttendanceBadge status={s.attendance as never} size="xs" /> <ShiftStatusBadge status={s.status as never} size="xs" /></td>
                    <td className="px-3 py-2"><TrustBadge trust={s.trust as never} size="xs" /></td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/attendance/${s.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
                        Details <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="mt-6 mb-2 font-display text-sm font-semibold">Leave balance, {new Date().getFullYear()}</h3>
        {leave ? (
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Casual" value={`${leave.casual_total - leave.casual_used}/${leave.casual_total}`} hint="remaining" />
            <StatTile label="Earned" value={`${leave.earned_total - leave.earned_used}/${leave.earned_total}`} hint="remaining" />
            <StatTile label="Unpaid taken" value={leave.unpaid_used} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No leave balance recorded for this year.</p>
        )}
      </Section>

      <Section title="Share profile" description="One-click link with the guard's verified KYC status — for clients or audits.">
        <SharePanel guardId={guard.id} shares={shares} origin={origin} guardPhone={guard.phone} guardName={guard.full_name} />
      </Section>

      <Section title="Lifecycle & access">
        <div className="flex flex-col gap-4">
          <LifecyclePanel guardId={guard.id} status={guard.status} guardName={guard.full_name} />
          {session.isOwner && (
            <div>
              <h3 className="mb-2 font-display text-sm font-semibold">Document access log</h3>
              {accessLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No KYC document has been viewed yet.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-xs">
                    <tbody className="divide-y">
                      {accessLogs.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-1.5 text-muted-foreground">{fmtDate(l.created_at, session.agency.timezone, "d MMM, HH:mm")}</td>
                          <td className="px-3 py-1.5">{l.purpose ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{l.share_id ? "via share link" : (uploaderNames[l.accessed_by ?? ""] ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
