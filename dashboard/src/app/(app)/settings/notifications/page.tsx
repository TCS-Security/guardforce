import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { loadNotificationOutbox, loadNotificationPreferences } from "@/lib/data/settings";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/gf/empty-state";
import { fmtDateTime } from "@/lib/domain/format";
import { markNotificationsRead } from "../actions";
import { PreferencesForm } from "./preferences-form";
import { Inbox } from "lucide-react";

export const metadata: Metadata = { title: "Notifications · Settings" };
export const dynamic = "force-dynamic";

const STATUS_TONE = { queued: "half-day", sent: "olive", failed: "absent", read: "neutral" } as const;

export default async function NotificationSettingsPage() {
  const session = await requireSession();
  const prefs = await loadNotificationPreferences(session);
  const outbox = session.isOwner ? await loadNotificationOutbox() : [];
  const unread = outbox.filter((n) => !n.read_at).map((n) => n.id);

  return (
    <div className="flex flex-col gap-4">
      <Section title="What reaches you" description="Alerts are raised per event; this controls which ones are pushed to you." style={{ ["--i" as string]: 1 }}>
        <PreferencesForm prefs={prefs} />
      </Section>

      {session.isOwner && (
        <Section
          title="Outbox"
          description="Everything the platform queued for delivery — push, WhatsApp and in-app."
          actions={
            unread.length > 0 ? (
              <form action={markNotificationsRead}>
                <input type="hidden" name="ids" value={unread.join(",")} />
                <Button type="submit" variant="outline" size="sm">Mark {unread.length} read</Button>
              </form>
            ) : null
          }
          bodyClassName="p-0"
          style={{ ["--i" as string]: 2 }}
        >
          {outbox.length === 0 ? (
            <EmptyState icon={<Inbox />} title="Nothing queued" description="Alerts appear here as events are raised." className="border-0" />
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm" aria-label="Notification outbox">
                <thead className="sticky top-0 bg-card">
                  <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                    <th>When</th>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Message</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {outbox.map((n) => (
                    <tr key={n.id} className={n.read_at ? "" : "bg-signal/[0.04]"}>
                      <td className="px-4 py-2 whitespace-nowrap"><Mono className="text-muted-foreground">{fmtDateTime(n.created_at, session.agency.timezone)}</Mono></td>
                      <td className="px-4 py-2 whitespace-nowrap">{n.recipient_name}</td>
                      <td className="px-4 py-2 capitalize text-muted-foreground">{n.channel.replace("_", "-")}</td>
                      <td className="px-4 py-2">
                        <div className="max-w-[420px] truncate">{n.title}</div>
                        {n.body && <div className="max-w-[420px] truncate text-xs text-muted-foreground">{n.body}</div>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <StatusPill tone={STATUS_TONE[n.status as keyof typeof STATUS_TONE] ?? "neutral"} size="xs" dot={false}>{n.status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
