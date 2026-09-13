"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/gf/form-alert";
import { updateNotificationPreferences, type ActionState } from "../actions";

const TOGGLES = [
  { name: "late_start", label: "Late shift starts", hint: "A guard has not checked in past the threshold" },
  { name: "fence_exit", label: "Fence exits", hint: "A guard leaves the site during a shift" },
  { name: "location_off", label: "Location switched off", hint: "The shift is at risk of being voided" },
  { name: "outage", label: "Tracking outages", hint: "No location for longer than the outage threshold" },
  { name: "patrol_missed", label: "Missed patrols", hint: "A scheduled round was never walked" },
  { name: "leave_requests", label: "Leave requests", hint: "A guard asks for leave" },
  { name: "daily_digest", label: "Daily digest", hint: "The morning per-site summary" },
] as const;

type Prefs = Record<(typeof TOGGLES)[number]["name"], boolean> & { whatsapp_number: string | null };

export function PreferencesForm({ prefs }: { prefs: Prefs }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateNotificationPreferences, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {TOGGLES.map((t) => (
          <div key={t.name} className="flex items-start justify-between gap-4 border-b pb-3">
            <div className="min-w-0">
              <Label htmlFor={t.name} className="font-medium">{t.label}</Label>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </div>
            <Switch id={t.name} name={t.name} defaultChecked={prefs[t.name]} />
          </div>
        ))}
      </div>
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="whatsapp_number">WhatsApp number</Label>
        <Input id="whatsapp_number" name="whatsapp_number" defaultValue={prefs.whatsapp_number ?? ""} placeholder="919845012345" className="font-mono" />
        <p className="text-xs text-muted-foreground">Country code first, no plus. Used for owner alerts and the daily digest.</p>
      </div>
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      {state?.ok && <FormAlert tone="success">Preferences saved.</FormAlert>}
      <div><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save preferences</Button></div>
    </form>
  );
}
