import { UserCog } from "lucide-react";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadCampus } from "@/lib/data/campus";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { SiteSwitcher } from "@/components/campus/site-switcher";
import { DeploymentBoard } from "@/components/campus/deployment-board";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage({ searchParams }: PageProps<"/deployments">) {
  const session = await requireSession();
  requirePermission(session, "guards:read");
  const { site } = await searchParams;
  const { sites, data } = await loadCampus(session, typeof site === "string" ? site : null);
  if (!data) return <EmptyState icon={<UserCog />} title="No sites in your scope" description="Add a site first." />;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Gate & campus · {data.campus.name}</>}
        title="Posts & duties"
        description="Which tower, floors and gates each guard covers, on which shift, with which duties — plus a reserve pool for relief. Phone battery and signal come live from the guard app."
        actions={<SiteSwitcher sites={sites} value={data.campus.site_id} />}
      />
      <PreviewBanner>Guard names, phones and battery are real; posts and duties are sample.</PreviewBanner>
      <DeploymentBoard data={data} canWrite={session.can("guards:write")} />
    </div>
  );
}
