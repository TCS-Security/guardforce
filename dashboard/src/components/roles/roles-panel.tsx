"use client";

import { useActionState, useState } from "react";
import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { FormAlert } from "@/components/gf/form-alert";
import { Mono } from "@/components/gf/mono";
import { deleteRole, type ActionState } from "@/app/(app)/settings/actions";
import { describePermissions } from "@/lib/auth/permissions";
import { RoleEditorDialog, type EditableRole } from "./role-editor";

export function RolesPanel({ roles, members, canEdit }: { roles: EditableRole[]; members: Record<string, number>; canEdit: boolean }) {
  const [editing, setEditing] = useState<EditableRole | "new" | null>(null);
  const [deleting, setDeleting] = useState<EditableRole | null>(null);

  return (
    <>
      <Section
        title="Roles"
        description="A role says what someone may see and do. Which sites they see is set per person on the Team tab."
        actions={canEdit ? <Button size="sm" onClick={() => setEditing("new")}><Plus data-icon="inline-start" /> New role</Button> : null}
        bodyClassName="p-0"
        style={{ ["--i" as string]: 1 }}
      >
        <ul className="divide-y">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  {r.system_key === "owner" && <StatusPill tone="olive" size="xs" dot={false}><Lock className="size-3" /> immutable</StatusPill>}
                  {r.is_system && r.system_key !== "owner" && <StatusPill tone="neutral" size="xs" dot={false}>built in</StatusPill>}
                </div>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                <Mono className="text-[11px] text-muted-foreground">
                  {describePermissions(r.permissions)} · {members[r.id] ?? 0} member{(members[r.id] ?? 0) === 1 ? "" : "s"}
                </Mono>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`${r.system_key === "owner" ? "View" : "Edit"} ${r.name}`} onClick={() => setEditing(r)}>
                    <Pencil />
                  </Button>
                  {!r.is_system && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <RoleEditorDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        role={editing === "new" ? undefined : editing ?? undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function DeleteRoleDialog({ role, onClose }: { role: EditableRole | null; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await deleteRole(prev, fd);
    if (res?.ok) onClose();
    return res;
  }, undefined);
  return (
    <Dialog open={!!role} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {role?.name}?</DialogTitle>
          <DialogDescription>Only roles nobody holds can be deleted. Reassign members first if needed.</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          <input type="hidden" name="id" value={role?.id ?? ""} />
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Delete role</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
