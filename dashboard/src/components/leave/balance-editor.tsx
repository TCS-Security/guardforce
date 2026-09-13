"use client";

import { useActionState, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBalance, type LeaveActionState } from "@/app/(app)/leave/actions";
import { BALANCE_DEFAULTS } from "@/lib/domain/leave";
import type { GuardBalance } from "@/lib/data/leave";

function Totals({ total, used }: { total: number; used: number }) {
  const left = total - used;
  return (
    <div className="leading-tight">
      <div><span className="font-medium">{left}</span> <span className="text-xs text-muted-foreground">left</span></div>
      <div className="text-xs text-muted-foreground"><Mono>{used}</Mono> used of <Mono>{total}</Mono></div>
    </div>
  );
}

/**
 * One balances-table row. Guards without a leave_balances row show the schema
 * defaults; saving creates the row. Totals are owner-editable inline.
 */
export function BalanceRow({ guard, year, editable }: { guard: GuardBalance; year: number; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<LeaveActionState, FormData>(async (prev, formData) => {
    const result = await saveBalance(prev, formData);
    if (result?.ok) setEditing(false);
    return result;
  }, undefined);
  const formId = useId();

  const casualTotal = guard.balance?.casual_total ?? BALANCE_DEFAULTS.casual_total;
  const earnedTotal = guard.balance?.earned_total ?? BALANCE_DEFAULTS.earned_total;
  const casualUsed = guard.balance?.casual_used ?? 0;
  const earnedUsed = guard.balance?.earned_used ?? 0;
  const unpaidUsed = guard.balance?.unpaid_used ?? 0;
  const noRow = !guard.balance;

  return (
    <tr className="transition-colors hover:bg-muted/50">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <GuardAvatar name={guard.name} src={guard.avatar} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{guard.name}</div>
            <div className="text-xs text-muted-foreground">{guard.code && <Mono>{guard.code}</Mono>}{guard.code && " · "}{guard.site_name ?? "No site"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <Input form={formId} name="casualTotal" type="number" min={0} max={365} defaultValue={casualTotal} aria-label={`Casual total for ${guard.name}`} className="h-8 w-20 tabular" />
        ) : (
          <Totals total={casualTotal} used={casualUsed} />
        )}
      </td>
      <td className="px-4 py-2.5">
        {editing ? (
          <Input form={formId} name="earnedTotal" type="number" min={0} max={365} defaultValue={earnedTotal} aria-label={`Earned total for ${guard.name}`} className="h-8 w-20 tabular" />
        ) : (
          <Totals total={earnedTotal} used={earnedUsed} />
        )}
      </td>
      <td className="px-4 py-2.5">
        {unpaidUsed > 0 ? <><span className="font-medium">{unpaidUsed}</span> <span className="text-xs text-muted-foreground">taken</span></> : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-2.5">
        {editable ? (
          editing ? (
            <form id={formId} action={action} className="flex flex-col items-start gap-1.5">
              <input type="hidden" name="guardId" value={guard.guard_id} />
              <input type="hidden" name="year" value={year} />
              <div className="flex items-center gap-1.5">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />} Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
              {state?.error && <div role="alert" data-testid="form-error" className="text-xs text-absent">{state.error}</div>}
            </form>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit{noRow && <span className="sr-only"> — no balance row yet; saving creates one</span>}
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
