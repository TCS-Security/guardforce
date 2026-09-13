"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/gf/status-pill";
import type { Guard } from "@/lib/supabase/types";
import { updateGuardProfile, resendInvite, type UpdateProfileState } from "./actions";

type Option = { id: string; name?: string; full_name?: string };

export function ProfileSection({
  guard, sites, supervisors, selfieUrl,
}: {
  guard: Guard;
  sites: Option[];
  supervisors: Option[];
  selfieUrl: string | null;
}) {
  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(updateGuardProfile, undefined);
  const [resendPending, startTransition] = useTransition();
  const err = (name: string) => state?.fieldErrors?.[name];

  function resend() {
    startTransition(async () => {
      const res = await resendInvite(guard.id);
      if (res?.error) toast.error(res.error);
      else toast.success("A fresh invite link was generated for re-verification");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Phone verification</span>
          {guard.phone_verified_at ? (
            <StatusPill tone="present" size="xs">Verified</StatusPill>
          ) : (
            <StatusPill tone="signal" size="xs">Unverified</StatusPill>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfieUrl} alt="Registration selfie" className="size-10 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <span className="text-xs text-muted-foreground">Selfie: captured in the app on first login</span>
          )}
          <Button type="button" variant="outline" size="xs" onClick={resend} disabled={resendPending}>
            {resendPending ? <Loader2 className="animate-spin" /> : <RotateCcw data-icon="inline-start" />}
            Resend invite
          </Button>
        </div>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="guard_id" value={guard.id} />
        {state?.error && (
          <div role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">
            {state.error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name" error={err("full_name")}>
            <Input id="full_name" name="full_name" defaultValue={guard.full_name} required aria-invalid={!!err("full_name")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" name="phone" defaultValue={guard.phone} inputMode="numeric" required aria-invalid={!!err("phone")} />
          </Field>
          <Field label="Designation / post" htmlFor="designation">
            <Input id="designation" name="designation" defaultValue={guard.designation ?? ""} />
          </Field>
          <Field label="Site" htmlFor="site_id">
            <Select name="site_id" defaultValue={guard.site_id ?? undefined}>
              <SelectTrigger id="site_id" className="w-full">
                <SelectValue placeholder="No site">{(v: string) => sites.find((s) => s.id === v)?.name ?? "No site"}</SelectValue>
              </SelectTrigger>
              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Supervisor" htmlFor="supervisor_id">
            <Select name="supervisor_id" defaultValue={guard.supervisor_id ?? undefined}>
              <SelectTrigger id="supervisor_id" className="w-full">
                <SelectValue placeholder="No supervisor">{(v: string) => supervisors.find((s) => s.id === v)?.full_name ?? "No supervisor"}</SelectValue>
              </SelectTrigger>
              <SelectContent>{supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date of birth" htmlFor="date_of_birth">
            <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={guard.date_of_birth ?? ""} />
          </Field>
          <Field label="Emergency contact" htmlFor="emergency_contact">
            <Input id="emergency_contact" name="emergency_contact" defaultValue={guard.emergency_contact ?? ""} />
          </Field>
          <Field label="Languages" htmlFor="languages">
            <Input id="languages" name="languages" defaultValue={(guard.languages ?? []).join(", ")} placeholder="hi, kn, en" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor="address">
              <Textarea id="address" name="address" rows={2} defaultValue={guard.address ?? ""} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p role="alert" className="text-xs text-absent">{error}</p>}
    </div>
  );
}
