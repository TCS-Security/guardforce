"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormAlert } from "@/components/gf/form-alert";
import { saveRole, type ActionState } from "@/app/(app)/settings/actions";
import { PERMISSION_RESOURCES, withImpliedReads, withoutResource, type PermissionKey } from "@/lib/auth/permissions";
import { cn } from "cn";

export type EditableRole = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  system_key: string | null;
  permissions: string[];
};

/**
 * The permission matrix. One row per area: a "view" switch, then that area's actions.
 * Turning an action on turns view on; turning view off clears the row.
 */
export function RoleEditorDialog({ role, open, onClose }: { role?: EditableRole; open: boolean; onClose: () => void }) {
  const readOnly = role?.system_key === "owner";
  const [keys, setKeys] = useState<Set<PermissionKey>>(() => new Set(withImpliedReads(role?.permissions ?? [])));
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await saveRole(prev, fd);
    if (res?.ok) onClose();
    return res;
  }, undefined);

  const count = keys.size;
  const total = useMemo(() => PERMISSION_RESOURCES.reduce((n, r) => n + 1 + r.actions.length, 0), []);

  function toggleRead(read: PermissionKey, on: boolean) {
    setKeys((prev) => new Set(on ? withImpliedReads([...prev, read]) : withoutResource(prev, read)));
  }
  function toggleAction(key: PermissionKey, on: boolean) {
    setKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return new Set(withImpliedReads(next));
    });
  }
  function setAll(on: boolean) {
    setKeys(on ? new Set(PERMISSION_RESOURCES.flatMap((r) => [r.read, ...r.actions.map((a) => a.key)])) : new Set());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
        else setKeys(new Set(withImpliedReads(role?.permissions ?? [])));
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? (readOnly ? "Owner role" : `Edit ${role.name}`) : "New role"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Owners always hold every permission. This role cannot be changed."
              : "Choose what people with this role can see and do. Site scope is set per person, not per role."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4">
          {role && <input type="hidden" name="id" value={role.id} />}
          <input type="hidden" name="permissions" value={[...keys].join(",")} />

          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" name="name" required maxLength={40} defaultValue={role?.name} placeholder="Ops lead" disabled={readOnly} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Input id="role-desc" name="description" maxLength={200} defaultValue={role?.description ?? ""} placeholder="Who this is for" disabled={readOnly} />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <span className="eyebrow">Permissions · {count} of {total}</span>
              {!readOnly && (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={() => setAll(true)}>Select all</Button>
                  <Button type="button" variant="ghost" size="xs" onClick={() => setAll(false)}>Clear</Button>
                </div>
              )}
            </div>
            <table className="w-full text-sm" aria-label="Permission matrix">
              <thead>
                <tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-1.5 [&>th]:font-normal">
                  <th className="w-[140px]">Area</th>
                  <th className="w-[90px]">View</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {PERMISSION_RESOURCES.map((r) => {
                  const canRead = keys.has(r.read);
                  return (
                    <tr key={r.resource} className={cn(!canRead && "text-muted-foreground")}>
                      <td className="px-3 py-2 font-medium">{r.label}</td>
                      <td className="px-3 py-2">
                        <Checkbox
                          aria-label={`View ${r.label}`}
                          checked={canRead}
                          disabled={readOnly}
                          onCheckedChange={(v) => toggleRead(r.read, !!v)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {r.actions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">View only</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {r.actions.map((a) => (
                              <Tooltip key={a.key}>
                                <TooltipTrigger render={<label className="flex cursor-pointer items-center gap-1.5 text-[13px]" />}>
                                  <Checkbox
                                    aria-label={`${a.label} ${r.label}`}
                                    checked={keys.has(a.key)}
                                    disabled={readOnly}
                                    onCheckedChange={(v) => toggleAction(a.key, !!v)}
                                  />
                                  {a.label}
                                </TooltipTrigger>
                                <TooltipContent>{a.hint}</TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && (
              <Button type="submit" disabled={pending || count === 0}>
                {pending && <Loader2 className="animate-spin" />}
                {role ? "Save role" : "Create role"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
