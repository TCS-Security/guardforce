"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/gf/section";
import { FormAlert } from "@/components/gf/form-alert";
import { updateAgency, type ActionState } from "./actions";
import type { Agency } from "@/lib/supabase/types";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Owner/admin-editable agency defaults. Read-only for everyone else. */
export function AgencyForm({ agency, editable }: { agency: Agency; editable: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAgency, undefined);

  if (!editable) {
    return (
      <Section title="Agency">
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Only the owner can edit agency settings. You can see the current values below.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {[
            ["Name", agency.name],
            ["City", agency.city ?? "—"],
            ["Timezone", agency.timezone],
            ["Late threshold", `${agency.late_threshold_min} min`],
            ["Default radius", `${agency.default_radius_m} m`],
            ["Default leeway", `${agency.default_leeway_m} m`],
            ["Half-day ratio", agency.half_day_ratio],
            ["Outage threshold", `${agency.outage_threshold_min} min`],
            ["Staleness", `${agency.staleness_min} min`],
            ["Location-off warning", `${agency.location_off_warn_min} min`],
            ["Selfie retention", `${agency.selfie_retention_days} days`],
            ["Digest time", agency.digest_time],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-mono tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Section title="Agency identity">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="name" label="Agency name">
            <Input id="name" name="name" required defaultValue={agency.name} />
          </Field>
          <Field id="city" label="City">
            <Input id="city" name="city" defaultValue={agency.city ?? ""} />
          </Field>
          <Field id="timezone" label="Timezone">
            <Input id="timezone" name="timezone" required defaultValue={agency.timezone} />
          </Field>
        </div>
      </Section>

      <Section title="Attendance & fence defaults" description="Applied agency-wide; individual sites can override radius/leeway.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="late_threshold_min" label="Late threshold (min)">
            <Input id="late_threshold_min" name="late_threshold_min" type="number" min={0} max={120} required defaultValue={agency.late_threshold_min} />
          </Field>
          <Field id="default_radius_m" label="Default radius (m)">
            <Input id="default_radius_m" name="default_radius_m" type="number" min={10} max={2000} required defaultValue={agency.default_radius_m} />
          </Field>
          <Field id="default_leeway_m" label="Default leeway (m)">
            <Input id="default_leeway_m" name="default_leeway_m" type="number" min={0} max={500} required defaultValue={agency.default_leeway_m} />
          </Field>
          <Field id="half_day_ratio" label="Half-day ratio" hint="Fraction of scheduled time counted as present">
            <Input id="half_day_ratio" name="half_day_ratio" type="number" min={0.1} max={0.9} step={0.05} required defaultValue={agency.half_day_ratio} />
          </Field>
          <Field id="selfie_retention_days" label="Selfie retention (days)">
            <Input id="selfie_retention_days" name="selfie_retention_days" type="number" min={1} max={3650} required defaultValue={agency.selfie_retention_days} />
          </Field>
          <Field id="digest_time" label="Digest time" hint="24h, agency timezone">
            <Input id="digest_time" name="digest_time" type="time" required defaultValue={agency.digest_time.slice(0, 5)} />
          </Field>
        </div>
      </Section>

      <Section title="Monitoring thresholds">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="outage_threshold_min" label="Outage threshold (min)">
            <Input id="outage_threshold_min" name="outage_threshold_min" type="number" min={1} max={180} required defaultValue={agency.outage_threshold_min} />
          </Field>
          <Field id="staleness_min" label="Live-map staleness (min)">
            <Input id="staleness_min" name="staleness_min" type="number" min={1} max={180} required defaultValue={agency.staleness_min} />
          </Field>
          <Field id="location_off_warn_min" label="Location-off warning interval (min)">
            <Input id="location_off_warn_min" name="location_off_warn_min" type="number" min={1} max={180} required defaultValue={agency.location_off_warn_min} />
          </Field>
        </div>
      </Section>

      {state?.error && <FormAlert>{state.error}</FormAlert>}
      {state?.ok && <FormAlert tone="success">Saved.</FormAlert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
