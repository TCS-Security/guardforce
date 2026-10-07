import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { ButtonLink } from "@/components/gf/button-link";
import { BulkAttendance } from "@/components/preview/bulk-attendance";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarkAttendancePage() {
  const session = await requireSession();
  requirePermission(session, "attendance:correct");
  const crew = await loadPreviewCrew(session);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Operate · Attendance</>}
        title="Mark a whole site"
        description="For sites where guards have no smartphone, or the network is down: the supervisor marks everyone posted there in one pass, with a group photo as proof."
        actions={<ButtonLink variant="ghost" href="/attendance"><ArrowLeft data-icon="inline-start" /> Attendance</ButtonLink>}
      />
      <PreviewBanner>Saving will write audited overrides, the same as correcting a single shift.</PreviewBanner>
      {crew.sites.length === 0
        ? <EmptyState title="No sites in your scope" description="You can only mark attendance for sites you supervise." />
        : <BulkAttendance sites={crew.sites} guards={crew.guards} today={crew.today} />}
    </div>
  );
}
