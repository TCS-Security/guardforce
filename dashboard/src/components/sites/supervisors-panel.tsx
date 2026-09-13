"use client";

import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { assignSupervisor } from "@/app/(app)/sites/actions";
import { useState } from "react";

type Person = { id: string; full_name: string; email: string | null };

/** Site-scoped supervisors (ROLE-1): who can see and run this site. */
export function SupervisorsPanel({
  siteId,
  assigned,
  candidates,
  canEdit,
}: {
  siteId: string;
  assigned: Person[];
  candidates: Person[];
  canEdit: boolean;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const available = candidates.filter((c) => !assigned.some((a) => a.id === c.id));

  return (
    <div className="flex flex-col gap-3">
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No supervisor is scoped to this site yet. Only owners and admins can see it.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {assigned.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
              <GuardAvatar name={p.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.full_name}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">{p.email}</div>
              </div>
              {canEdit && (
                <form action={assignSupervisor}>
                  <input type="hidden" name="site_id" value={siteId} />
                  <input type="hidden" name="profile_id" value={p.id} />
                  <input type="hidden" name="attach" value="false" />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remove ${p.full_name}`}>
                    <X />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && available.length > 0 && (
        <form action={assignSupervisor} className="flex gap-2">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="attach" value="true" />
          <input type="hidden" name="profile_id" value={pick ?? ""} />
          <Select value={pick ?? undefined} onValueChange={(v) => setPick(v as string)}>
            <SelectTrigger className="h-8 flex-1" aria-label="Choose a supervisor">
              <SelectValue placeholder="Add a supervisor…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline" disabled={!pick}>
            <UserPlus data-icon="inline-start" /> Assign
          </Button>
        </form>
      )}
    </div>
  );
}
