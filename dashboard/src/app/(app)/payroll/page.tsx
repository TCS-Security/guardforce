import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generatePayroll, payMonth } from "@/lib/preview/payroll";
import { fmtDate } from "@/lib/domain/format";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { PayrollRun } from "@/components/preview/payroll-run";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const session = await requireSession();
  requirePermission(session, "reports:read");
  const crew = await loadPreviewCrew(session);
  const month = payMonth(crew.today);
  const rows = generatePayroll(crew, month);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Money · Payroll</>}
        title={<>Payroll — {fmtDate(`${month}-01T00:00:00+05:30`, session.agency.timezone, "MMMM yyyy")}</>}
        description="Salaries computed from the locked muster roll and approved overtime, with PF, ESI and professional tax worked out per guard."
      />
      <PreviewBanner>Wages, deductions and bank status are generated; the attendance days will come from the muster roll.</PreviewBanner>
      <PayrollRun rows={rows} month={month} />
    </div>
  );
}
