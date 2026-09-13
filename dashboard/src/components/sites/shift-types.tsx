"use client";

import { useActionState, useState } from "react";
import { Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/gf/status-pill";
import { EmptyState } from "@/components/gf/empty-state";
import { saveShiftType, deleteShiftType, type ActionState } from "@/app/(app)/sites/actions";
import { SHIFT_TYPE_PRESETS, crossesMidnight, shiftDurationMinutes, shiftWindowLabel } from "@/lib/domain/sites";
import { fmtMinutes } from "@/lib/domain/format";
import type { ShiftType } from "@/lib/supabase/types";

export function ShiftTypesPanel({
  siteId,
  shiftTypes,
  usage,
  canEdit,
}: {
  siteId: string;
  shiftTypes: ShiftType[];
  usage: Record<string, number>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ShiftType | "new" | null>(null);
  const [deleting, setDeleting] = useState<ShiftType | null>(null);

  const missingPresets = SHIFT_TYPE_PRESETS.filter((p) => !shiftTypes.some((s) => s.name.toLowerCase() === p.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {shiftTypes.length === 0 ? (
        <EmptyState
          icon={<Clock />}
          title="No shifts defined"
          description="Add the shifts this site runs — guards are rostered against them."
          action={canEdit ? <Button size="sm" onClick={() => setEditing("new")}><Plus data-icon="inline-start" /> Add shift</Button> : null}
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {shiftTypes.map((st) => {
            const used = usage[st.id] ?? 0;
            return (
              <li key={st.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{st.name}</span>
                    {crossesMidnight(st) && <StatusPill tone="neutral" size="xs" dot={false}>overnight</StatusPill>}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {shiftWindowLabel(st)} · {fmtMinutes(shiftDurationMinutes(st))} · {st.guards_required} guard{st.guards_required === 1 ? "" : "s"}
                    {used > 0 && ` · ${used} roster entries`}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${st.name}`} onClick={() => setEditing(st)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${st.name}`} onClick={() => setDeleting(st)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && shiftTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" /> Add shift
          </Button>
          {missingPresets.map((p) => (
            <PresetButton key={p.name} siteId={siteId} preset={p} />
          ))}
        </div>
      )}

      <ShiftTypeDialog siteId={siteId} shiftType={editing === "new" ? undefined : editing ?? undefined} open={editing !== null} onClose={() => setEditing(null)} />
      <DeleteShiftTypeDialog siteId={siteId} shiftType={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function PresetButton({ siteId, preset }: { siteId: string; preset: (typeof SHIFT_TYPE_PRESETS)[number] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveShiftType, undefined);
  return (
    <form action={action} className="contents">
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="name" value={preset.name} />
      <input type="hidden" name="start_time" value={preset.start_time} />
      <input type="hidden" name="end_time" value={preset.end_time} />
      <input type="hidden" name="guards_required" value={2} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} title={state?.error}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus data-icon="inline-start" />}
        {preset.name} {preset.start_time}–{preset.end_time}
      </Button>
    </form>
  );
}

function ShiftTypeDialog({ siteId, shiftType, open, onClose }: { siteId: string; shiftType?: ShiftType; open: boolean; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await saveShiftType(prev, fd);
    if (result?.ok) onClose();
    return result;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shiftType ? `Edit ${shiftType.name}` : "Add a shift"}</DialogTitle>
          <DialogDescription>A shift that ends before it starts runs past midnight.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="site_id" value={siteId} />
          {shiftType && <input type="hidden" name="id" value={shiftType.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-name">Name</Label>
            <Input id="st-name" name="name" required defaultValue={shiftType?.name} placeholder="Night" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-start">Start</Label>
              <Input id="st-start" name="start_time" type="time" required defaultValue={(shiftType?.start_time ?? "22:00").slice(0, 5)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-end">End</Label>
              <Input id="st-end" name="end_time" type="time" required defaultValue={(shiftType?.end_time ?? "06:00").slice(0, 5)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-guards">Guards</Label>
              <Input id="st-guards" name="guards_required" type="number" min={1} max={100} required defaultValue={shiftType?.guards_required ?? 2} />
            </div>
          </div>
          {state?.error && <p role="alert" className="text-sm text-absent">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save shift</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteShiftTypeDialog({ siteId, shiftType, onClose }: { siteId: string; shiftType: ShiftType | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await deleteShiftType(prev, fd);
    if (result?.ok) onClose();
    return result;
  }, undefined);

  return (
    <Dialog open={!!shiftType} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {shiftType?.name}?</DialogTitle>
          <DialogDescription>Guards already rostered to this shift keep their history; the shift can only be removed when nothing references it.</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          <input type="hidden" name="id" value={shiftType?.id ?? ""} />
          <input type="hidden" name="site_id" value={siteId} />
          {state?.error && <p role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Delete shift</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
