"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/gf/form-alert";
import { updateAppConfig, type ActionState } from "../actions";

type Config = {
  min_app_version: string;
  ota_channel: string;
  ping_interval_moving_s: number;
  ping_interval_stationary_s: number;
  selfie_max_kb: number;
  photo_max_kb: number;
  features: unknown;
};

export function AppConfigForm({ config, canEdit }: { config: Config; canEdit: boolean }) {
  const [channel, setChannel] = useState(config.ota_channel);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAppConfig, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="ota_channel" value={channel} />
      <fieldset disabled={!canEdit} className="contents">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min_app_version">Minimum app version</Label>
            <Input id="min_app_version" name="min_app_version" defaultValue={config.min_app_version} className="font-mono" />
            <p className="text-xs text-muted-foreground">Older builds are asked to update before a shift can start.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ota_channel">OTA channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as string)}>
              <SelectTrigger id="ota_channel" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="beta">Beta</SelectItem>
                <SelectItem value="canary">Canary</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Which JavaScript bundle the app pulls at launch.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="features">Feature flags (JSON)</Label>
            <Textarea
              id="features"
              name="features"
              rows={3}
              defaultValue={JSON.stringify(config.features ?? {}, null, 0)}
              className="font-mono text-xs"
              placeholder='{"alertness_checks": true}'
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ping_interval_moving_s">Ping when moving (s)</Label>
            <Input id="ping_interval_moving_s" name="ping_interval_moving_s" type="number" min={30} max={1800} defaultValue={config.ping_interval_moving_s} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ping_interval_stationary_s">Ping when still (s)</Label>
            <Input id="ping_interval_stationary_s" name="ping_interval_stationary_s" type="number" min={60} max={3600} defaultValue={config.ping_interval_stationary_s} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="selfie_max_kb">Selfie cap (KB)</Label>
            <Input id="selfie_max_kb" name="selfie_max_kb" type="number" min={40} max={1024} defaultValue={config.selfie_max_kb} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photo_max_kb">Photo cap (KB)</Label>
            <Input id="photo_max_kb" name="photo_max_kb" type="number" min={60} max={4096} defaultValue={config.photo_max_kb} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Longer intervals and smaller caps save battery and data on budget phones — the two things guards notice first.
        </p>
      </fieldset>

      {state?.error && <FormAlert>{state.error}</FormAlert>}
      {state?.ok && <FormAlert tone="success">Config saved. Apps pick it up on their next launch.</FormAlert>}
      {canEdit && <div><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save config</Button></div>}
    </form>
  );
}
