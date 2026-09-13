"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideLeave, type LeaveActionState } from "@/app/(app)/leave/actions";

/**
 * Confirm-style dialog for a leave decision. Declining requires a note
 * (validated server-side too); approving may add one.
 */
export function DecisionDialog({
  leaveId, guardName, mode, trigger,
}: {
  leaveId: string;
  guardName: string;
  mode: "approve" | "decline";
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<LeaveActionState, FormData>(decideLeave, undefined);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  const approve = mode === "approve";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{approve ? "Approve leave" : "Decline leave"} — {guardName}</DialogTitle>
          <DialogDescription>
            {approve
              ? "Approving marks rostered shifts in this range as on leave and deducts the days from the guard's balance."
              : "The guard is notified of the decision. Explain why so they can plan around it."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="leaveId" value={leaveId} />
          <input type="hidden" name="decision" value={mode} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`note-${leaveId}`}>
              Note {approve ? <span className="text-muted-foreground">(optional)</span> : <span aria-hidden className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={`note-${leaveId}`}
              name="note"
              rows={3}
              maxLength={500}
              required={!approve}
              placeholder={approve ? "Anything worth recording for later…" : "e.g. Short-staffed that week — please try next week."}
            />
          </div>
          {state?.error && (
            <div role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">
              {state.error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={approve ? "default" : "destructive"} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {approve ? "Approve leave" : "Decline leave"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
