import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadPreviewCrew } from "@/lib/data/preview";
import { generateSos } from "@/lib/preview/sos";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { SosBoard } from "@/components/preview/sos-board";

export const dynamic = "force-dynamic";

export default async function SosPage() {
  const session = await requireSession();
  requirePermission(session, "events:read");
  const crew = await loadPreviewCrew(session);
  const now = new Date();
  const { alerts, lone } = generateSos(crew, now);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={<>Monitor · SOS</>}
        title="SOS & lone workers"
        description="Panic button, fall detection, and a check-in timer for guards alone on a post. Every alert stays on top until someone owns it."
      />
      <PreviewBanner />
      <SosBoard initial={alerts} lone={lone} now={now.toISOString()} canRespond={session.can("events:acknowledge")} responder={session.profile.full_name} />
    </div>
  );
}
