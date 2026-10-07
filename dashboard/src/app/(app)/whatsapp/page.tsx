import { requirePermission, requireSession } from "@/lib/auth/session";
import { loadWhatsapp } from "@/lib/data/whatsapp";
import { PageHeader } from "@/components/gf/page-header";
import { PreviewBanner } from "@/components/gf/preview-banner";
import { BotConsole } from "@/components/whatsapp/bot-console";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const session = await requireSession();
  requirePermission(session, "events:read");
  const { now, alerts, contacts, messages } = await loadWhatsapp(session);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Alerts · WhatsApp"
        title="WhatsApp alert bot"
        description="One verified number that tells supervisors who is absent (with their phone numbers), raises incidents the moment they are logged, chases guards on long breaks or gone missing, and sends the photo report of anything serious."
      />
      <PreviewBanner>Absences, incidents and guard presence are read from your live data; nothing is actually sent.</PreviewBanner>
      <BotConsole alerts={alerts} contacts={contacts} messages={messages} now={now} canAck={session.can("events:acknowledge")} canManage={session.can("settings:write")} agencyName={session.agency.name} />
    </div>
  );
}
