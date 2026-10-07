import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { DEFAULT_OT_POLICY, generateOvertime } from "@/lib/preview/overtime";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { OvertimeBoard } from "@/components/preview/overtime-board";

export const dynamic = "force-dynamic";

export default async function OvertimePage() {
  const session = await requireSession();
  requirePermission(session, "attendance:read");
  const crew = await loadPreviewCrew(session);
  const entries = generateOvertime(crew);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Money · Overtime</>}
        title="Overtime"
        description="Every minute a guard stays past the rostered end, checked against the weekly cap before it reaches payroll."
      />
      <PreviewBanner>Approved overtime will flow into the payroll register at {DEFAULT_OT_POLICY.multiplier}× the hourly rate.</PreviewBanner>
      <OvertimeBoard initial={entries} today={crew.today} canDecide={session.can("attendance:correct")} />
    </div>
  );
}
