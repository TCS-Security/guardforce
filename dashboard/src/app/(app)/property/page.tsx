import { Blocks } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { PropertyMasters } from "@/components/campus/property-masters";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ searchParams }: PageProps<"/property">) {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const { site } = await searchParams;
  const { sites, data } = await loadCampus(session, typeof site === "string" ? site : null);
  if (!data) return <EmptyState icon={<Blocks />} title="No sites in your scope" description="Add a site first." />;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.name}</>}
        title="Property setup"
        description="The campus behind the site: towers, floors with their QR checkpoints and fences, the tenants visitors come to see, and the gates. Import in bulk from a spreadsheet."
        actions={<SiteSwitcher sites={sites} value={data.campus.site_id} />}
      />
      <PreviewBanner />
      <PropertyMasters data={data} canWrite={session.can("sites:write")} />
    </div>
  );
}
