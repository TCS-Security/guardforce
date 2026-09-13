"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/gf/mono";
import { fmtDateTime } from "@/lib/domain/format";
import { inviteDeepLink, inviteMessage, whatsappUrl, smsUrl } from "@/lib/domain/guards";
import { markInviteSent, resendInvite } from "./actions";

type Invite = { id: string; token: string; sent_at: string | null; channel: string; expires_at: string };

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

export function InvitePanel({
  guardId, guardName, agencyName, phone, invite,
}: {
  guardId: string;
  guardName: string;
  agencyName: string;
  phone: string;
  invite: Invite | null;
}) {
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const res = await resendInvite(guardId);
      if (res?.error) toast.error(res.error);
      else toast.success("New invite link generated");
    });
  }

  function markSent() {
    if (!invite) return;
    startTransition(async () => {
      const res = await markInviteSent(invite.id, guardId);
      if (res?.error) toast.error(res.error);
      else toast.success("Marked as sent");
    });
  }

  if (!invite) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">No invite has been generated yet.</span>
        <Button type="button" size="sm" onClick={resend} disabled={pending}>Generate invite</Button>
      </div>
    );
  }

  const deepLink = inviteDeepLink(invite.token);
  const message = inviteMessage(guardName, agencyName, invite.token);

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-signal/25 bg-signal/6 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Invite pending — send the app install link</div>
        {invite.sent_at ? (
          <span className="text-xs text-muted-foreground">Sent {fmtDateTime(invite.sent_at)}</span>
        ) : (
          <span className="text-xs text-signal">Not sent yet</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Mono className="min-w-0 flex-1 truncate rounded border bg-background px-2 py-1">{deepLink}</Mono>
        <Button type="button" variant="outline" size="icon-xs" aria-label="Copy invite link" onClick={() => copy(deepLink, "Invite link")}>
          <Copy />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="xs" nativeButton={false} render={<a href={whatsappUrl(phone, message)} target="_blank" rel="noopener noreferrer" />}>
          <MessageCircle data-icon="inline-start" /> WhatsApp
        </Button>
        <Button variant="outline" size="xs" nativeButton={false} render={<a href={smsUrl(phone, message)} />}>
          <Send data-icon="inline-start" /> SMS
        </Button>
        {!invite.sent_at && (
          <Button type="button" size="xs" onClick={markSent} disabled={pending}>Mark as sent</Button>
        )}
        <Button type="button" variant="ghost" size="xs" onClick={resend} disabled={pending}>
          <RotateCcw data-icon="inline-start" /> New link
        </Button>
      </div>
    </div>
  );
}
