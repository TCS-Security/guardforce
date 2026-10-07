import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generateCashbook } from "@/lib/preview/cashbook";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { CashbookLedger } from "@/components/preview/cashbook-ledger";

export const dynamic = "force-dynamic";

export default async function CashbookPage() {
  const session = await requireSession();
  requirePermission(session, "reports:read");
  const crew = await loadPreviewCrew(session);
  const { opening, entries } = generateCashbook(crew, session.profile.full_name);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Money · Cashbook</>}
        title="Cashbook"
        description="Petty cash, salary advances and client collections in one running ledger, so the cash in the drawer always matches the book."
      />
      <PreviewBanner />
      <CashbookLedger opening={opening} initial={entries} sites={crew.sites.map((s) => s.name)} today={crew.today} recorder={session.profile.full_name} />
    </div>
  );
}
