import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generatePostOrders } from "@/lib/preview/site-ops";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { EmptyState } from "@/components/gf/empty-state";
import { PostOrdersBoard } from "@/components/preview/post-orders-board";

export const dynamic = "force-dynamic";

export default async function PostOrdersPage() {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const crew = await loadPreviewCrew(session);
  const orders = generatePostOrders(crew);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Operate · Post orders</>}
        title="Post orders"
        description="The standing instructions for each post, versioned. Guards read and accept them in the app before their first shift, and again whenever they change."
      />
      <PreviewBanner />
      {crew.sites.length === 0
        ? <EmptyState title="No sites yet" description="Post orders are written per site. Add a site first." />
        : <PostOrdersBoard sites={crew.sites} initial={orders} canEdit={session.can("sites:write")} editor={session.profile.full_name} />}
    </div>
  );
}
