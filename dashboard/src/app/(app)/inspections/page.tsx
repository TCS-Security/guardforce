import { ScanLine } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { InspectionBoard } from "@/components/campus/inspection-board";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({ searchParams }: PageProps<"/inspections">) {
  const session = await requireSession();
  requirePermission(session, "patrols:read");
  const { site } = await searchParams;
  const { sites, data, shifted } = await loadCampus(session, typeof site === "string" ? site : null);
  if (!data) return <EmptyState icon={<ScanLine />} title="No sites in your scope" description="Add a site first." />;
  const inspector = data.deployments.find((d) => d.duties.includes("inspection"))?.guard ?? { id: session.profile.id, full_name: session.profile.full_name };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.name}</>}
        title="Floor inspections"
        description="A daily survey of every floor that proves the guard was there and turns every fault into a task — not just a tick on a register."
        actions={<SiteSwitcher sites={sites} value={data.campus.site_id} />}
      />
      <PreviewBanner>{shifted ? "Outside gate hours the sample day is shown as of 3 PM." : null}</PreviewBanner>
      <InspectionBoard data={data} inspector={{ id: inspector.id, name: inspector.full_name }} canSignOff={session.can("patrols:write")} />
    </div>
  );
}
