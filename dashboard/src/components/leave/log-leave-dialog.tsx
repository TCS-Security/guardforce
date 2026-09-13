"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logLeave, type LeaveActionState } from "@/app/(app)/leave/actions";
import type { GuardOption } from "@/lib/data/leave";
import { LEAVE_TYPE } from "@/lib/domain/status";

/** Log a leave request on behalf of a guard (they asked on WhatsApp). */
export function LogLeaveDialog({ guards }: { guards: GuardOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<LeaveActionState, FormData>(logLeave, undefined);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plane data-icon="inline-start" /> Log leave
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log leave for a guard</DialogTitle>
          <DialogDescription>
            For requests that arrive on WhatsApp. Save it as pending for review, or approve it right away.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="ll-guard">Guard</Label>
            <Select name="guardId" required>
              <SelectTrigger id="ll-guard" className="w-full" aria-label="Guard">
                <SelectValue placeholder="Choose a guard…" />
              </SelectTrigger>
              <SelectContent>
                {guards.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.label}{g.site_name ? ` — ${g.site_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="ll-type">Leave type</Label>
            <Select name="type" defaultValue="casual" required>
              <SelectTrigger id="ll-type" className="w-full" aria-label="Leave type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEAVE_TYPE) as (keyof typeof LEAVE_TYPE)[]).map((t) => (
                  <SelectItem key={t} value={t}>{LEAVE_TYPE[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor="ll-start">From</Label>
              <Input id="ll-start" name="startDate" type="date" required />
            </Field>
            <Field>
              <Label htmlFor="ll-end">To</Label>
              <Input id="ll-end" name="endDate" type="date" required />
            </Field>
          </div>
          <Field>
            <Label htmlFor="ll-reason">Reason</Label>
            <Textarea id="ll-reason" name="reason" rows={2} maxLength={500} required placeholder="What the guard told you" />
          </Field>
          {state?.error && (
            <FieldError role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">
              {state.error}
            </FieldError>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" name="approveNow" value="0" variant="outline" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save as pending
            </Button>
            <Button type="submit" name="approveNow" value="1" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save &amp; approve
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
