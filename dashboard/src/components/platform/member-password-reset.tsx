"use client";

import { useActionState, useState } from "react";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/gf/form-alert";
import { resetMemberPassword, type PlatformActionState } from "@/app/platform/actions";

/** Support tool: issue a new one-time password when an owner locks themselves out. */
export function MemberPasswordReset({ profileId, agencyId, name }: { profileId: string; agencyId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PlatformActionState, FormData>(resetMemberPassword, undefined);

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Reset password for ${name}`} onClick={() => setOpen(true)}>
        <KeyRound />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password for {name}</DialogTitle>
            <DialogDescription>Generates a one-time password to pass on. Their existing sessions stay signed in.</DialogDescription>
          </DialogHeader>
          {state?.password ? (
            <div className="flex flex-col gap-3">
              <FormAlert tone="success">New password issued for {state.email}.</FormAlert>
              <div className="flex gap-1.5">
                <Input readOnly value={state.password} className="font-mono" aria-label="One-time password" />
                <Button type="button" variant="outline" size="icon" aria-label="Copy password" onClick={() => navigator.clipboard.writeText(state.password!)}>
                  <Copy />
                </Button>
              </div>
              <DialogFooter><Button type="button" onClick={() => setOpen(false)}>Done</Button></DialogFooter>
            </div>
          ) : (
            <form action={action} className="contents">
              <input type="hidden" name="profile_id" value={profileId} />
              <input type="hidden" name="agency_id" value={agencyId} />
              {state?.error && <FormAlert>{state.error}</FormAlert>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Issue password</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
