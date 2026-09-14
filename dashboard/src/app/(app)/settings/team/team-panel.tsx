"use client";

import { useActionState, useState } from "react";
import { Copy, Loader2, Power, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { FormAlert } from "@/components/gf/form-alert";
import { Mono } from "@/components/gf/mono";
import { ButtonLink } from "@/components/gf/button-link";
import { inviteTeamMember, setTeamMemberActive, updateTeamMember, type ActionState, type InviteState } from "../actions";
import { describePermissions } from "@/lib/auth/permissions";

export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  role_id: string | null;
  all_sites: boolean;
  is_active: boolean;
  role_name: string | null;
  sites: { site_id: string; name: string }[];
};
export type Site = { id: string; name: string };
export type RoleOption = { id: string; name: string; description: string | null; system_key: string | null; permissions: string[] };

/**
 * Team access. Each person has a role (what they may do) and a site scope (which sites
 * they see). Owners hold every permission and every site, and cannot be demoted here.
 */
export function TeamPanel({
  team,
  sites,
  roles,
  canEdit,
  currentUserId,
}: {
  team: Member[];
  sites: Site[];
  roles: RoleOption[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const assignable = roles.filter((r) => r.system_key !== "owner");

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Team access"
        description="Role decides what someone can do; site scope decides where."
        actions={
          <div className="flex items-center gap-1.5">
            <ButtonLink href="/settings/roles" variant="ghost" size="sm">Roles</ButtonLink>
            {canEdit && <Button size="sm" onClick={() => setInviting(true)}><UserPlus data-icon="inline-start" /> Invite</Button>}
          </div>
        }
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
            {team.map((m) => {
              const isOwner = m.role === "owner";
              return (
                <tr key={m.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <GuardAvatar name={m.full_name} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {m.full_name}
                          {m.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <Mono className="text-muted-foreground">{m.email}</Mono>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{m.role_name ?? (isOwner ? "Owner" : "No role")}</span>
                    {!m.role_name && !isOwner && <StatusPill tone="signal" size="xs" dot={false} className="ml-1.5">no access</StatusPill>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {isOwner || m.all_sites ? "All sites" : m.sites.length === 0 ? <span className="text-signal">No sites scoped</span> : m.sites.map((s) => s.name).join(", ")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.is_active ? <StatusPill tone="present" size="xs" dot={false}>Active</StatusPill> : <StatusPill tone="neutral" size="xs" dot={false}>Disabled</StatusPill>}
                      {canEdit && !isOwner && (
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
              );
            })}
          </tbody>
        </table>
      </Section>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} sites={sites} roles={assignable} />
      <EditDialog key={editing?.id ?? "none"} member={editing} sites={sites} roles={assignable} onClose={() => setEditing(null)} />
    </div>
  );
}

function RolePicker({ roles, value, onChange }: { roles: RoleOption[]; value: string; onChange: (v: string) => void }) {
  const selected = roles.find((r) => r.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="role-picker">Role</Label>
      <Select value={value} onValueChange={(v) => onChange(v as string)}>
        <SelectTrigger id="role-picker" className="w-full">
          <SelectValue>{(v: string) => roles.find((r) => r.id === v)?.name ?? "Pick a role"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {selected && (
        <p className="text-xs text-muted-foreground">
          {selected.description ?? ""} <Mono className="text-[11px]">{describePermissions(selected.permissions)}</Mono>
        </p>
      )}
    </div>
  );
}

function ScopePicker({
  sites,
  allSites,
  selected,
  onAllSites,
  onChange,
}: {
  sites: Site[];
  allSites: boolean;
  selected: string[];
  onAllSites: (v: boolean) => void;
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Site scope</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={allSites} onCheckedChange={(v) => onAllSites(!!v)} aria-label="Every site" />
          Every site, including ones added later
        </label>
      </div>
      {!allSites && (
        <div className="flex flex-col gap-1.5 rounded-md border p-2.5">
          {sites.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(s.id)}
                onCheckedChange={(v) => onChange(v ? [...selected, s.id] : selected.filter((id) => id !== s.id))}
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function InviteDialog({ open, onClose, sites, roles }: { open: boolean; onClose: () => void; sites: Site[]; roles: RoleOption[] }) {
  const defaultRole = roles.find((r) => r.system_key === "supervisor")?.id ?? roles[0]?.id ?? "";
  const [roleId, setRoleId] = useState(defaultRole);
  const [allSites, setAllSites] = useState(false);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteTeamMember, undefined);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite to the dashboard</DialogTitle>
          <DialogDescription>Creates a login straight away. Share the one-time password yourself; no email is sent.</DialogDescription>
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
              <p className="text-xs text-muted-foreground">Shown once. Ask them to change it under My profile.</p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="role_id" value={roleId} />
            <input type="hidden" name="all_sites" value={allSites ? "true" : "false"} />
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
            </div>
            <RolePicker roles={roles} value={roleId} onChange={setRoleId} />
            <ScopePicker sites={sites} allSites={allSites} selected={siteIds} onAllSites={setAllSites} onChange={setSiteIds} />
            {state?.error && <FormAlert>{state.error}</FormAlert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending || !roleId}>{pending && <Loader2 className="animate-spin" />}Create login</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ member, sites, roles, onClose }: { member: Member | null; sites: Site[]; roles: RoleOption[]; onClose: () => void }) {
  const [roleId, setRoleId] = useState(member?.role_id ?? "");
  const [allSites, setAllSites] = useState(member?.all_sites ?? false);
  const [siteIds, setSiteIds] = useState<string[]>(member?.sites.map((s) => s.site_id) ?? []);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await updateTeamMember(prev, fd);
    if (r?.ok) onClose();
    return r;
  }, undefined);

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member?.full_name}</DialogTitle>
          <DialogDescription>Change what this person can do and which sites they see.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="profile_id" value={member?.id ?? ""} />
          <input type="hidden" name="role_id" value={roleId} />
          <input type="hidden" name="all_sites" value={allSites ? "true" : "false"} />
          <input type="hidden" name="site_ids" value={siteIds.join(",")} />
          <RolePicker roles={roles} value={roleId} onChange={setRoleId} />
          <ScopePicker sites={sites} allSites={allSites} selected={siteIds} onAllSites={setAllSites} onChange={setSiteIds} />
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || !roleId}>{pending && <Loader2 className="animate-spin" />}Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
