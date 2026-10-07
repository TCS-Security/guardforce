import { DoorOpen } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { VisitorDesk } from "@/components/campus/visitor-desk";

export const dynamic = "force-dynamic";

export default async function VisitorsPage({ searchParams }: PageProps<"/visitors">) {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const { site } = await searchParams;
  const { sites, data, shifted } = await loadCampus(session, typeof site === "string" ? site : null);
  if (!data) return <EmptyState icon={<DoorOpen />} title="No sites in your scope" description="Add a site first; the gate desk runs on top of it." />;
  const deskGuard = data.deployments.find((d) => d.duties.includes("visitor") && d.online)?.guard.full_name ?? session.profile.full_name;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.name}</>}
        title="Visitor desk"
        description="Register walk-ins with a live photo, get the host's yes on WhatsApp, check them in against a badge and out again, and watch anyone who stays too long."
        actions={<SiteSwitcher sites={sites} value={data.campus.site_id} />}
      />
      <PreviewBanner>{shifted ? "Outside gate hours the sample day is shown as of 3 PM." : null}</PreviewBanner>
      <VisitorDesk data={data} deskGuard={deskGuard} canWrite={session.can("sites:write")} />
    </div>
  );
}
