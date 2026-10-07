import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { buildDar, clientAccounts, sentLog } from "@/lib/preview/client-reports";
import { addDays } from "@/lib/preview/crew";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { ClientReportsBoard } from "@/components/preview/client-reports-board";

export const dynamic = "force-dynamic";

export default async function ClientReportsPage() {
  const session = await requireSession();
  requirePermission(session, "reports:read");
  const crew = await loadPreviewCrew(session);
  const accounts = clientAccounts(crew);
  const yesterday = addDays(crew.today, -1);
  const reports = Object.fromEntries(accounts.map((a) => [a.key, buildDar(a, crew, yesterday)]));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Report · Client reports</>}
        title="Client daily reports"
        description="Every morning each client gets one email: who was on duty at their sites, patrols done, alertness checks, and anything that happened. Proof of service without anyone asking."
      />
      <PreviewBanner>No emails are sent from this screen yet.</PreviewBanner>
      {accounts.length === 0
        ? <EmptyState title="No clients yet" description="Clients come from the client name on each site." />
        : <ClientReportsBoard accounts={accounts} reports={reports} log={sentLog(accounts, crew.today, new Date())} date={yesterday} agencyName={session.agency.name} canEdit={session.can("reports:export")} />}
    </div>
  );
}
