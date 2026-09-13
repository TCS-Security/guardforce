"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createGuard, type CreateGuardState } from "./actions";

type Option = { id: string; name?: string; full_name?: string };

export function NewGuardForm({ sites, supervisors, suggestedCode }: { sites: Option[]; supervisors: Option[]; suggestedCode: string }) {
  const [state, action, pending] = useActionState<CreateGuardState, FormData>(createGuard, undefined);
  const err = (name: string) => state?.fieldErrors?.[name];

  return (
    <form action={action} className="flex flex-col gap-6">
      {state?.error && (
        <div role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" required aria-invalid={!!err("full_name")} />
          {err("full_name") && <p role="alert" className="text-xs text-absent">{err("full_name")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" inputMode="numeric" placeholder="9900000000" required aria-invalid={!!err("phone")} />
          {err("phone") && <p role="alert" className="text-xs text-absent">{err("phone")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee_code">Employee code</Label>
          <Input id="employee_code" name="employee_code" defaultValue={suggestedCode} required aria-invalid={!!err("employee_code")} />
          {err("employee_code") && <p role="alert" className="text-xs text-absent">{err("employee_code")}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="designation">Designation / post</Label>
          <Input id="designation" name="designation" placeholder="Gate Guard" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site_id">Site</Label>
          <Select name="site_id">
            <SelectTrigger id="site_id" className="w-full">
              <SelectValue placeholder="Assign a site">{(v: string) => sites.find((s) => s.id === v)?.name ?? "Assign a site"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supervisor_id">Supervisor</Label>
          <Select name="supervisor_id">
            <SelectTrigger id="supervisor_id" className="w-full">
              <SelectValue placeholder="Assign a supervisor">{(v: string) => supervisors.find((s) => s.id === v)?.full_name ?? "Assign a supervisor"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_of_birth">Date of birth</Label>
          <Input id="date_of_birth" name="date_of_birth" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emergency_contact">Emergency contact</Label>
          <Input id="emergency_contact" name="emergency_contact" placeholder="Name · phone" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="languages">Languages</Label>
          <Input id="languages" name="languages" placeholder="hi, kn, en" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Add guard
        </Button>
      </div>
    </form>
  );
}
