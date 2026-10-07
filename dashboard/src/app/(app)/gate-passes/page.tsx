import { FileBadge } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { GatePassRegister } from "@/components/campus/gate-pass-register";

export const dynamic = "force-dynamic";

export default async function GatePassesPage({ searchParams }: PageProps<"/gate-passes">) {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const { site } = await searchParams;
  const { sites, data, shifted } = await loadCampus(session, typeof site === "string" ? site : null);
  if (!data) return <EmptyState icon={<FileBadge />} title="No sites in your scope" description="Add a site first." />;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.name}</>}
        title="Gate passes"
        description="Contractor work permits, material in and out against a challan, and VIP passes — each with a printable slip and a QR the gate scans."
        actions={<SiteSwitcher sites={sites} value={data.campus.site_id} />}
      />
      <PreviewBanner>{shifted ? "Outside gate hours the sample day is shown as of 3 PM." : null}</PreviewBanner>
      <GatePassRegister data={data} officer={session.profile.full_name} canWrite={session.can("sites:write")} />
    </div>
  );
}
