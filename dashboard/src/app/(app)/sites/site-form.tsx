"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Section } from "@/components/gf/section";
import { FenceEditor } from "@/components/sites/fence-editor";
import { createSite, updateSite, type ActionState } from "./actions";
import type { Site } from "@/lib/supabase/types";

type Defaults = {
  lat: number;
  lng: number;
  radius_m: number;
  leeway_m: number;
};

/** Create/edit form. The fence editor contributes lat/lng/fence_type/radius/leeway/polygon. */
export function SiteForm({
  site,
  defaults,
  submitLabel,
}: {
  site?: Site;
  defaults: Defaults;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(site ? updateSite : createSite, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {site && <input type="hidden" name="id" value={site.id} />}

      <Section title="Site details" style={{ ["--i" as string]: 1 }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Site name</Label>
            <Input id="name" name="name" required defaultValue={site?.name} placeholder="Prestige Tech Park — Gate 3" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client_name">Client</Label>
            <Input id="client_name" name="client_name" defaultValue={site?.client_name ?? ""} placeholder="Prestige Group" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={site?.city ?? ""} placeholder="Bengaluru" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={site?.address ?? ""} placeholder="Outer Ring Rd, Kadubeesanahalli" />
          </div>
        </div>
      </Section>

      <Section
        title="Perimeter & leeway"
        description="Place the site, then set how far outside the boundary still counts as on-site."
        style={{ ["--i" as string]: 2 }}
      >
        <FenceEditor
          initial={{
            lat: site?.lat ?? defaults.lat,
            lng: site?.lng ?? defaults.lng,
            radius_m: site?.radius_m ?? defaults.radius_m,
            leeway_m: site?.leeway_m ?? defaults.leeway_m,
            fence_type: (site?.fence_type as "radius" | "polygon") ?? "radius",
            polygon: site?.polygon,
          }}
        />
      </Section>

      <Section title="Staffing & proof" style={{ ["--i" as string]: 3 }}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guards_required">Guards required</Label>
            <Input
              id="guards_required"
              name="guards_required"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={site?.guards_required ?? 2}
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">Posts to be filled across all shifts. Drives the coverage gap alert.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="patrol_photo_required">Patrol photo proof</Label>
            <div className="flex items-center gap-2.5">
              <Switch id="patrol_photo_required" name="patrol_photo_required" defaultChecked={site?.patrol_photo_required ?? true} />
              <span className="text-sm">Photos mandatory to close a patrol</span>
            </div>
            <p className="text-xs text-muted-foreground">When on, a guard cannot finish a round at this site without the photos the route asks for.</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={site?.notes ?? ""} placeholder="Gate timings, client contact, basement GPS is poor…" />
          </div>
        </div>
      </Section>

      {state?.error && (
        <div role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div role="status" className="rounded-md border border-present/30 bg-present/8 px-3 py-2 text-sm text-present">
          Saved.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
