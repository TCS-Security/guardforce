"use client";

import { useActionState, useState } from "react";
import { Loader2, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/gf/form-alert";
import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY, INCIDENT_TYPE, INCIDENT_TYPES } from "@/lib/domain/incidents";
import { logIncident, type ActionState } from "@/app/(app)/incidents/actions";

type Site = { id: string; name: string };
type Guard = { id: string; full_name: string; site_id: string | null };

/**
 * Report an incident. Deliberately short: what, where, when, how bad, and the narrative —
 * a supervisor fills this in on a phone with the client standing next to them.
 */
export function LogIncidentDialog({ sites, guards, defaultNow }: { sites: Site[]; guards: Guard[]; defaultNow: string }) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [type, setType] = useState<string>("theft");
  const [severity, setSeverity] = useState<string>("moderate");
  const [guardId, setGuardId] = useState("none");
  const [state, action, pending] = useActionState<ActionState, FormData>(logIncident, undefined);

  const siteGuards = guards.filter((g) => g.site_id === siteId);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Siren data-icon="inline-start" /> Log incident
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log an incident</DialogTitle>
            <DialogDescription>
              A major occurrence — a fight, a theft, a fire, a medical emergency. Routine alerts already arrive on the events feed.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="site_id" value={siteId} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="severity" value={severity} />
            <input type="hidden" name="guard_id" value={guardId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-site">Site</Label>
                <Select value={siteId} onValueChange={(v) => { setSiteId(v as string); setGuardId("none"); }}>
                  <SelectTrigger id="inc-site" className="w-full">
                    <SelectValue>{(v: string) => sites.find((s) => s.id === v)?.name ?? "Pick a site"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-when">When it happened</Label>
                <Input id="inc-when" name="occurred_at" type="datetime-local" defaultValue={defaultNow} required />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-type">What happened</Label>
                <Select value={type} onValueChange={(v) => setType(v as string)}>
                  <SelectTrigger id="inc-type" className="w-full">
                    <SelectValue>{(v: string) => INCIDENT_TYPE[(v || "other") as keyof typeof INCIDENT_TYPE]?.label ?? "Pick a type"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((t) => <SelectItem key={t} value={t}>{INCIDENT_TYPE[t].label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{INCIDENT_TYPE[type as keyof typeof INCIDENT_TYPE]?.hint}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-severity">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as string)}>
                  <SelectTrigger id="inc-severity" className="w-full">
                    <SelectValue>{(v: string) => INCIDENT_SEVERITY[(v || "moderate") as keyof typeof INCIDENT_SEVERITY]?.label ?? "Severity"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SEVERITIES.map((s) => <SelectItem key={s} value={s}>{INCIDENT_SEVERITY[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{INCIDENT_SEVERITY[severity as keyof typeof INCIDENT_SEVERITY]?.hint}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inc-title">Title</Label>
              <Input id="inc-title" name="title" required placeholder="Two laptops taken from the B2 parking level" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inc-desc">What happened, in full</Label>
              <Textarea
                id="inc-desc"
                name="description"
                rows={5}
                required
                placeholder="Who was involved, what was done, who was informed, and what the client was told."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-guard">Guard involved</Label>
                <Select value={guardId} onValueChange={(v) => setGuardId(v as string)}>
                  <SelectTrigger id="inc-guard" className="w-full">
                    <SelectValue>{(v: string) => (!v || v === "none" ? "Nobody in particular" : (guards.find((g) => g.id === v)?.full_name ?? "Nobody in particular"))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nobody in particular</SelectItem>
                    {siteGuards.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-lat">Latitude <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="inc-lat" name="lat" inputMode="decimal" placeholder="12.9354" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inc-lng">Longitude <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="inc-lng" name="lng" inputMode="decimal" placeholder="77.6925" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Leave the coordinates blank and the map falls back to the site itself.
            </p>

            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending || !siteId}>
                {pending && <Loader2 className="animate-spin" />}Log incident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
