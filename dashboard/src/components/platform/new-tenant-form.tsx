"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Section } from "@/components/gf/section";
import { FormAlert } from "@/components/gf/form-alert";
import { createTenant, type PlatformActionState } from "@/app/platform/actions";
import { PLANS } from "./tenant-status";

export function NewTenantForm() {
  const [plan, setPlan] = useState<string>("pilot");
  const [status, setStatus] = useState<string>("trial");
  const [state, action, pending] = useActionState<PlatformActionState, FormData>(createTenant, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="status" value={status} />

      <Section title="Agency" style={{ ["--i" as string]: 1 }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-name">Agency name</Label>
            <Input id="t-name" name="name" required placeholder="Falcon Facility Services" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-slug">Slug</Label>
            <Input id="t-slug" name="slug" placeholder="falcon (derived from the name if blank)" className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-city">City</Label>
            <Input id="t-city" name="city" placeholder="Pune" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-plan">Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as string)}>
              <SelectTrigger id="t-plan" className="w-full">
                <SelectValue>{(v: string) => PLANS.find((p) => p.value === v)?.label ?? "Pilot"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label} — {p.hint}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-status">Starts as</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as string)}>
              <SelectTrigger id="t-status" className="w-full">
                <SelectValue>{(v: string) => (v === "active" ? "Active customer" : "Trial")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-max">Guard seat cap</Label>
            <Input id="t-max" name="max_guards" type="number" min={1} placeholder="Leave blank for no cap" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-notes">Internal notes</Label>
            <Textarea id="t-notes" name="notes" rows={2} placeholder="How they found us, who the champion is, contract terms" />
          </div>
        </div>
      </Section>

      <Section title="First owner" description="Gets the immutable Owner role and every site." style={{ ["--i" as string]: 2 }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="o-name">Name</Label>
            <Input id="o-name" name="owner_name" required placeholder="Neha Kulkarni" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="o-email">Email</Label>
            <Input id="o-email" name="owner_email" type="email" required placeholder="neha@falcon.in" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="o-phone">Phone</Label>
            <Input id="o-phone" name="owner_phone" placeholder="9820012345" />
          </div>
        </div>
      </Section>

      {state?.error && <FormAlert>{state.error}</FormAlert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Create tenant
        </Button>
      </div>
    </form>
  );
}
