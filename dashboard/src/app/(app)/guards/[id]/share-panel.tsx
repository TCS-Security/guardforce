"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { fmtDate, fmtDateTime } from "@/lib/domain/format";
import { shareState, shareDaysLeft, whatsappUrl, SHARE_EXPIRY_DEFAULT_DAYS, SHARE_EXPIRY_MAX_DAYS } from "@/lib/domain/guards";
import type { ProfileShare } from "@/lib/supabase/types";
import { createGuardShare, revokeGuardShare, type ShareState } from "./actions";

const STATE_TONE = { active: "present", expired: "neutral", revoked: "absent" } as const;

export function SharePanel({
  guardId, shares, origin, guardPhone, guardName,
}: {
  guardId: string;
  shares: ProfileShare[];
  origin: string;
  guardPhone: string;
  guardName: string;
}) {
  const [state, action, pending] = useActionState<ShareState, FormData>(createGuardShare, undefined);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        <input type="hidden" name="guard_id" value={guardId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-label">Label</Label>
          <Input id="share-label" name="label" placeholder="e.g. Client audit" className="w-48" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-days">Expires after (days)</Label>
          <Input id="share-days" name="expiry_days" type="number" min={1} max={SHARE_EXPIRY_MAX_DAYS} defaultValue={SHARE_EXPIRY_DEFAULT_DAYS} className="w-28" />
        </div>
        <Label className="flex items-center gap-2 pb-1.5">
          <Switch name="include_documents" defaultChecked />
          Include documents
        </Label>
        {state?.error && <p role="alert" className="text-sm text-absent">{state.error}</p>}
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending && <Loader2 className="animate-spin" />}
          Create share link
        </Button>
      </form>

      {shares.length === 0 ? (
        <EmptyState title="No share links yet" description="Create one to send a verified profile to a client or auditor." />
      ) : (
        <div className="divide-y rounded-md border">
          {shares.map((s) => (
            <ShareRow key={s.id} share={s} guardId={guardId} origin={origin} guardPhone={guardPhone} guardName={guardName} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareRow({ share, guardId, origin, guardPhone, guardName }: { share: ProfileShare; guardId: string; origin: string; guardPhone: string; guardName: string }) {
  const [pending, startTransition] = useTransition();
  const state = shareState(share);
  const url = `${origin}/share/${share.token}`;

  function revoke() {
    startTransition(async () => {
      const res = await revokeGuardShare(share.id, guardId);
      if (res?.error) toast.error(res.error);
      else toast.success("Share revoked");
    });
  }

  return (
    <div className="flex flex-col gap-2 p-3" data-testid="share-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{share.label || "Untitled share"}</span>
          <StatusPill tone={STATE_TONE[state]} size="xs" dot={false}>{state}</StatusPill>
        </div>
        <div className="text-xs text-muted-foreground">
          {share.view_count} view{share.view_count === 1 ? "" : "s"}
          {share.last_viewed_at && <> · last viewed {fmtDateTime(share.last_viewed_at)}</>}
          {state === "active" && <> · {shareDaysLeft(share.expires_at)}d left · expires {fmtDate(share.expires_at)}</>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Mono className="min-w-0 flex-1 truncate rounded border bg-background px-2 py-1">{url}</Mono>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Copy share link"
          onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Share link copied"))}
        >
          <Copy />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          nativeButton={false}
          aria-label="Share on WhatsApp"
          render={<a href={whatsappUrl(guardPhone, `${guardName}'s verified profile: ${url}`)} target="_blank" rel="noopener noreferrer" />}
        >
          <MessageCircle />
        </Button>
        {state === "active" && (
          <Button type="button" variant="destructive" size="xs" onClick={revoke} disabled={pending}>
            <Ban data-icon="inline-start" /> Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
