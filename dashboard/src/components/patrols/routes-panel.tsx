"use client";

import { useActionState, useState } from "react";
import { Loader2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { FormAlert } from "@/components/gf/form-alert";
import { Mono } from "@/components/gf/mono";
import { deletePatrolRoute, savePatrolRoute, setRouteActive, type ActionState } from "@/app/(app)/patrols/actions";
import { fmtMinutes } from "@/lib/domain/format";

type Route = {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  frequency_min: number;
  grace_min: number;
  min_photos: number;
  shift_type_id: string | null;
  is_active: boolean;
  sites: { name: string; patrol_photo_required: boolean } | null;
  shift_types: { name: string } | null;
};
type Site = { id: string; name: string; patrol_photo_required: boolean };
type ShiftType = { id: string; name: string; site_id: string };

export function RoutesPanel({
  routes,
  sites,
  shiftTypes,
  canEdit,
}: {
  routes: Route[];
  sites: Site[];
  shiftTypes: ShiftType[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Route | "new" | null>(null);
  const [deleting, setDeleting] = useState<Route | null>(null);

  const bySite = sites.map((s) => ({ site: s, routes: routes.filter((r) => r.site_id === s.id) }));

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" /> New route
          </Button>
        </div>
      )}

      {bySite.map(({ site, routes: siteRoutes }, i) => (
        <Section
          key={site.id}
          title={site.name}
          description={site.patrol_photo_required ? "Photo proof required at this site" : "Photo proof optional at this site"}
          bodyClassName="p-0"
          style={{ ["--i" as string]: i }}
        >
          {siteRoutes.length === 0 ? (
            <EmptyState title="No rounds defined" description="Guards at this site are not asked to patrol." className="border-0 py-8" />
          ) : (
            <ul className="divide-y">
              {siteRoutes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.name}</span>
                      {!r.is_active && <StatusPill tone="neutral" size="xs" dot={false}>paused</StatusPill>}
                      {r.shift_types?.name && <StatusPill tone="olive" size="xs" dot={false}>{r.shift_types.name} only</StatusPill>}
                    </div>
                    {r.description && <p className="truncate text-xs text-muted-foreground">{r.description}</p>}
                    <Mono className="text-[11px] text-muted-foreground">
                      every {fmtMinutes(r.frequency_min)} · {r.grace_min} min grace · {r.min_photos} photo{r.min_photos === 1 ? "" : "s"}
                    </Mono>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={setRouteActive}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={r.is_active ? "false" : "true"} />
                        <Button type="submit" variant="ghost" size="icon-sm" aria-label={`${r.is_active ? "Pause" : "Resume"} ${r.name}`}>
                          {r.is_active ? <Pause /> : <Play />}
                        </Button>
                      </form>
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      <RouteDialog
        route={editing === "new" ? undefined : editing ?? undefined}
        open={editing !== null}
        sites={sites}
        shiftTypes={shiftTypes}
        onClose={() => setEditing(null)}
      />
      <DeleteRouteDialog route={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function RouteDialog({
  route,
  open,
  sites,
  shiftTypes,
  onClose,
}: {
  route?: Route;
  open: boolean;
  sites: Site[];
  shiftTypes: ShiftType[];
  onClose: () => void;
}) {
  const [siteId, setSiteId] = useState(route?.site_id ?? sites[0]?.id ?? "");
  const [shiftTypeId, setShiftTypeId] = useState(route?.shift_type_id ?? "all");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await savePatrolRoute(prev, fd);
    if (res?.ok) onClose();
    return res;
  }, undefined);

  const siteShiftTypes = shiftTypes.filter((s) => s.site_id === siteId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); else if (route) { setSiteId(route.site_id); setShiftTypeId(route.shift_type_id ?? "all"); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{route ? `Edit ${route.name}` : "New patrol route"}</DialogTitle>
          <DialogDescription>Rounds are scheduled automatically from the moment a guard starts a shift.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {route && <input type="hidden" name="id" value={route.id} />}
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="shift_type_id" value={shiftTypeId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-site">Site</Label>
              <Select value={siteId} onValueChange={(v) => { setSiteId(v as string); setShiftTypeId("all"); }}>
                <SelectTrigger id="route-site" className="w-full">
                  <SelectValue>{(v: string) => sites.find((s) => s.id === v)?.name ?? "Pick a site"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-shift">Applies to</Label>
              <Select value={shiftTypeId} onValueChange={(v) => setShiftTypeId(v as string)}>
                <SelectTrigger id="route-shift" className="w-full">
                  <SelectValue>{(v: string) => (!v || v === "all" ? "Every shift" : (siteShiftTypes.find((s) => s.id === v)?.name ?? "Every shift"))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every shift</SelectItem>
                  {siteShiftTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="route-name">Name</Label>
            <Input id="route-name" name="name" required defaultValue={route?.name} placeholder="Perimeter round" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="route-desc">What to check</Label>
            <Textarea id="route-desc" name="description" rows={2} defaultValue={route?.description ?? ""} placeholder="Compound wall, both gates and the basement ramp" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-freq">Every (min)</Label>
              <Input id="route-freq" name="frequency_min" type="number" min={15} max={720} required defaultValue={route?.frequency_min ?? 120} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-grace">Grace (min)</Label>
              <Input id="route-grace" name="grace_min" type="number" min={0} max={120} required defaultValue={route?.grace_min ?? 15} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-photos">Photos</Label>
              <Input id="route-photos" name="min_photos" type="number" min={0} max={10} required defaultValue={route?.min_photos ?? 1} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            A round started after the grace window counts as late. Photos are only enforced when the site requires photo proof.
          </p>

          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save route</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRouteDialog({ route, onClose }: { route: Route | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await deletePatrolRoute(prev, fd);
    if (res?.ok) onClose();
    return res;
  }, undefined);

  return (
    <Dialog open={!!route} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {route?.name}?</DialogTitle>
          <DialogDescription>Routes with recorded rounds are paused instead, so past patrols stay readable.</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          <input type="hidden" name="id" value={route?.id ?? ""} />
          {state?.error && <FormAlert tone="warning">{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
            <Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Delete route</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
