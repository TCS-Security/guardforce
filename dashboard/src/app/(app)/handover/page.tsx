import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generateHandovers } from "@/lib/preview/site-ops";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { HandoverBoard } from "@/components/preview/handover-board";

export const dynamic = "force-dynamic";

export default async function HandoverPage() {
  const session = await requireSession();
  requirePermission(session, "sites:read");
  const crew = await loadPreviewCrew(session);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Operate · Handover</>}
        title="Handover register"
        description="What the outgoing guard tells the incoming one: open issues, keys and kit that changed hands. The incoming guard reads it before they can start the shift."
      />
      <PreviewBanner />
      <HandoverBoard initial={generateHandovers(crew)} sites={crew.sites} guards={crew.guards} today={crew.today} />
    </div>
  );
}
