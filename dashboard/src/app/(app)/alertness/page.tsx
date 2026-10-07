import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generateAlertness } from "@/lib/preview/alertness";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { AlertnessBoard } from "@/components/preview/alertness-board";

export const dynamic = "force-dynamic";

export default async function AlertnessPage() {
  const session = await requireSession();
  requirePermission(session, "events:read");
  const crew = await loadPreviewCrew(session);
  const checks = generateAlertness(crew);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Monitor · Alertness checks</>}
        title="Alertness checks"
        description="At random moments through the night the guard app rings and asks for a selfie. A late or missing answer goes straight to the supervisor."
      />
      <PreviewBanner>The guard-app side (the ring, the selfie, the face match) ships with the app update.</PreviewBanner>
      <AlertnessBoard checks={checks} guards={crew.guards} canConfigure={session.can("settings:write")} />
    </div>
  );
}
