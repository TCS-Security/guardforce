"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { deactivateGuard, reactivateGuard } from "./actions";
import type { GuardStatus } from "@/lib/supabase/types";

export function LifecyclePanel({ guardId, status, guardName }: { guardId: string; status: GuardStatus; guardName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function reactivate() {
    startTransition(async () => {
      const res = await reactivateGuard(guardId);
      if (res?.error) toast.error(res.error);
      else toast.success(`${guardName} reactivated`);
    });
  }

  function deactivate() {
    startTransition(async () => {
      const res = await deactivateGuard(guardId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`${guardName} deactivated`);
        setOpen(false);
      }
    });
  }

  if (status === "inactive") {
    return (
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={reactivate} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserCheck data-icon="inline-start" />}
        Reactivate guard
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" className="self-start" />}>
        <UserX data-icon="inline-start" /> Deactivate guard
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {guardName}?</DialogTitle>
          <DialogDescription>
            They will no longer be assignable to shifts. This is logged in the audit trail and can be reversed later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" onClick={deactivate} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
