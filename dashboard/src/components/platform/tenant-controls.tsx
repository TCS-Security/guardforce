"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/gf/section";
import { FormAlert } from "@/components/gf/form-alert";
import { setTenantStatus, updateTenant, type PlatformActionState } from "@/app/platform/actions";
import { PLANS } from "./tenant-status";
import type { Agency } from "@/lib/supabase/types";

export function TenantControls({ agency }: { agency: Agency }) {
  const [plan, setPlan] = useState(agency.plan);
  const [state, action, pending] = useActionState<PlatformActionState, FormData>(updateTenant, undefined);
  const locked = agency.status === "suspended" || agency.status === "churned";

  return (
    <>
      <Section title="Plan & limits" style={{ ["--i" as string]: 7 }}>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={agency.id} />
          <input type="hidden" name="plan" value={plan} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-name">Name</Label>
            <Input id="ag-name" name="name" defaultValue={agency.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-plan">Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as string)}>
                <SelectTrigger id="ag-plan" className="w-full">
                  <SelectValue>{(v: string) => PLANS.find((p) => p.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-max">Guard seat cap</Label>
              <Input id="ag-max" name="max_guards" type="number" min={1} defaultValue={agency.max_guards ?? ""} placeholder="none" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-city">City</Label>
            <Input id="ag-city" name="city" defaultValue={agency.city ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ag-notes">Internal notes</Label>
            <Textarea id="ag-notes" name="notes" rows={3} defaultValue={agency.notes ?? ""} />
          </div>
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          {state?.ok && <FormAlert tone="success">Saved.</FormAlert>}
          <div><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save</Button></div>
        </form>
      </Section>

      <Section title="Access" style={{ ["--i" as string]: 9 }}>
        <p className="mb-3 text-sm text-muted-foreground">
          {locked
            ? "Restoring access lets every member back in immediately."
            : "Suspending locks every member out on their next request. Data, history and logins are all kept."}
        </p>
        <StatusDialog key={agency.status} agency={agency} />
      </Section>
    </>
  );
}

function StatusDialog({ agency }: { agency: Agency }) {
  const locked = agency.status === "suspended" || agency.status === "churned";
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(locked ? "active" : "suspended");
  const [state, action, pending] = useActionState<PlatformActionState, FormData>(async (prev, fd) => {
    const res = await setTenantStatus(prev, fd);
    if (res?.ok) setOpen(false);
    return res;
  }, undefined);

  return (
    <>
      <Button variant={locked ? "default" : "destructive"} size="sm" onClick={() => setOpen(true)}>
        {locked ? <><ShieldCheck data-icon="inline-start" /> Restore access</> : <><ShieldOff data-icon="inline-start" /> Suspend tenant</>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{locked ? "Restore access" : "Suspend this tenant?"}</DialogTitle>
            <DialogDescription>
              {locked ? "Choose the status the tenant returns to." : "The reason is shown to their owner on the lock-out screen."}
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={agency.id} />
            <input type="hidden" name="status" value={target} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-target">New status</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as string)}>
                <SelectTrigger id="st-target" className="w-full">
                  <SelectValue>{(v: string) => ({ trial: "Trial", active: "Active", suspended: "Suspended", churned: "Closed" })[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locked ? (
                    <>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="churned">Closed</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {!locked && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="st-reason">Reason</Label>
                <Textarea id="st-reason" name="reason" rows={3} required minLength={5} placeholder="Invoice 90 days overdue; contact accounts@guardforce.in" />
              </div>
            )}
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant={locked ? "default" : "destructive"} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {locked ? "Restore" : "Suspend"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
