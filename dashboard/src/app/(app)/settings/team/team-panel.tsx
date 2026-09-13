"use client";

import { useActionState, useState } from "react";
import { Copy, Loader2, Power, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { FormAlert } from "@/components/gf/form-alert";
import { Mono } from "@/components/gf/mono";
import { inviteTeamMember, setTeamMemberActive, updateTeamMember, type ActionState, type InviteState } from "../actions";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  sites: { site_id: string; name: string }[];
};
type Site = { id: string; name: string };

export function TeamPanel({ team, sites, canEdit, currentUserId }: { team: Member[]; sites: Site[]; canEdit: boolean; currentUserId: string }) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Team access"
        description="Owners see everything. Supervisors only see the sites they are scoped to."
        actions={canEdit ? <Button size="sm" onClick={() => setInviting(true)}><UserPlus data-icon="inline-start" /> Invite</Button> : null}
        bodyClassName="p-0"
        style={{ ["--i" as string]: 1 }}
      >
        <table className="w-full text-sm" aria-label="Team members">
          <thead>
            <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
              <th>Person</th>
              <th>Role</th>
              <th>Sites</th>
              <th className="text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {team.map((m) => (
              <tr key={m.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <GuardAvatar name={m.full_name} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.full_name}{m.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</div>
                      <Mono className="text-muted-foreground">{m.email}</Mono>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 capitalize">{m.role}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {m.role === "owner" || m.role === "admin" ? "All sites" : m.sites.length === 0 ? <span className="text-signal">No sites scoped</span> : m.sites.map((s) => s.name).join(", ")}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {m.is_active ? <StatusPill tone="present" size="xs" dot={false}>Active</StatusPill> : <StatusPill tone="neutral" size="xs" dot={false}>Disabled</StatusPill>}
                    {canEdit && m.role !== "owner" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>Edit</Button>
                        {m.id !== currentUserId && (
                          <form action={setTeamMemberActive}>
                            <input type="hidden" name="profile_id" value={m.id} />
                            <input type="hidden" name="active" value={m.is_active ? "false" : "true"} />
                            <Button type="submit" variant="ghost" size="icon-sm" aria-label={`${m.is_active ? "Disable" : "Enable"} ${m.full_name}`}>
                              <Power />
                            </Button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} sites={sites} />
      <EditDialog member={editing} sites={sites} onClose={() => setEditing(null)} />
    </div>
  );
}

function SitePicker({ sites, selected, onChange, disabled }: { sites: Site[]; selected: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Sites</Label>
      <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
        {sites.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(s.id)}
              disabled={disabled}
              onCheckedChange={(v) => onChange(v ? [...selected, s.id] : selected.filter((id) => id !== s.id))}
            />
            {s.name}
          </label>
        ))}
      </div>
      {disabled && <p className="text-xs text-muted-foreground">Admins already see every site.</p>}
    </div>
  );
}

function InviteDialog({ open, onClose, sites }: { open: boolean; onClose: () => void; sites: Site[] }) {
  const [role, setRole] = useState<"supervisor" | "admin">("supervisor");
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteTeamMember, undefined);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite to the dashboard</DialogTitle>
          <DialogDescription>Creates a login straight away. Share the one-time password yourself — no email is sent.</DialogDescription>
        </DialogHeader>

        {state?.password ? (
          <div className="flex flex-col gap-3">
            <FormAlert tone="success">Login created for {state.email}.</FormAlert>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-pw">One-time password</Label>
              <div className="flex gap-1.5">
                <Input id="temp-pw" readOnly value={state.password} className="font-mono" />
                <Button type="button" variant="outline" size="icon" aria-label="Copy password" onClick={() => navigator.clipboard.writeText(state.password!)}>
                  <Copy />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This is shown once. Ask them to change it under My profile.</p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="site_ids" value={siteIds.join(",")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-name">Full name</Label>
                <Input id="inv-name" name="full_name" required placeholder="Priya Nair" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" name="email" type="email" required placeholder="priya@agency.in" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-phone">Phone</Label>
                <Input id="inv-phone" name="phone" placeholder="9845012345" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "supervisor" | "admin")}>
                  <SelectTrigger id="inv-role" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">Supervisor — scoped to sites</SelectItem>
                    <SelectItem value="admin">Admin — all sites</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SitePicker sites={sites} selected={siteIds} onChange={setSiteIds} disabled={role === "admin"} />
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Create login</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ member, sites, onClose }: { member: Member | null; sites: Site[]; onClose: () => void }) {
  const [role, setRole] = useState<string>(member?.role ?? "supervisor");
  const [siteIds, setSiteIds] = useState<string[]>(member?.sites.map((s) => s.site_id) ?? []);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await updateTeamMember(prev, fd);
    if (r?.ok) onClose();
    return r;
  }, undefined);

  return (
    <Dialog
      open={!!member}
      onOpenChange={(v) => {
        if (!v) onClose();
        else if (member) { setRole(member.role); setSiteIds(member.sites.map((s) => s.site_id)); }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member?.full_name}</DialogTitle>
          <DialogDescription>Change the role or the sites this person can see.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="profile_id" value={member?.id ?? ""} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="site_ids" value={siteIds.join(",")} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as string)}>
              <SelectTrigger id="edit-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SitePicker sites={sites} selected={siteIds} onChange={setSiteIds} disabled={role === "admin"} />
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
