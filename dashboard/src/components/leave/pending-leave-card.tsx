import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { Button } from "@/components/ui/button";
import { fmtAgo } from "@/lib/domain/format";
import { fmtLeaveRange, THIN_COVER_THRESHOLD } from "@/lib/domain/leave";
import { LEAVE_TYPE } from "@/lib/domain/status";
import type { PendingItem } from "@/lib/data/leave";
import { DecisionDialog } from "./decision-dialog";

/** One pending request in the inbox: guard, dates, balance, staffing impact, decision actions. */
export function PendingLeaveCard({ item }: { item: PendingItem }) {
  const name = item.guard_name ?? "Guard";
  const { impact } = item;
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <GuardAvatar name={name} src={item.guard_avatar} />
        <div className="min-w-0">
          <div className="truncate font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">
            {item.guard_code && <Mono>{item.guard_code}</Mono>}
            {item.guard_code && " · "}
            {item.site_name ?? "No site"}
          </div>
        </div>
      </div>

      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral" dot={false} size="xs">{LEAVE_TYPE[item.type]}</StatusPill>
          <span className="text-sm font-medium">{fmtLeaveRange(item.start_date, item.end_date)}</span>
          <Mono className="text-muted-foreground">{item.days} day{item.days === 1 ? "" : "s"}</Mono>
        </div>
        {item.reason && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={item.reason}>
            “{item.reason}”
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>requested {fmtAgo(item.created_at)}</span>
          <span aria-hidden>·</span>
          <span>
            {item.remaining == null ? (
              <>unpaid — no cap</>
            ) : (
              <><span className="font-medium text-foreground">{item.remaining}</span> of {item.total} {LEAVE_TYPE[item.type].toLowerCase()} left</>
            )}
          </span>
          <span aria-hidden>·</span>
          {impact.count === 0 ? (
            <span>no other approved leave at this site</span>
          ) : (
            <span>
              <span className="font-medium text-foreground">{impact.count}</span> other{impact.count === 1 ? "" : "s"} out at {item.site_name ?? "site"} on these dates
              {impact.names.length > 0 && <span className="hidden xl:inline"> ({impact.names.join(", ")})</span>}
            </span>
          )}
          {impact.maxPerDay >= THIN_COVER_THRESHOLD && (
            <StatusPill tone="signal" size="xs">Thin cover</StatusPill>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DecisionDialog
          leaveId={item.id}
          guardName={name}
          mode="approve"
          trigger={<Button size="sm">Approve</Button>}
        />
        <DecisionDialog
          leaveId={item.id}
          guardName={name}
          mode="decline"
          trigger={<Button size="sm" variant="outline">Decline…</Button>}
        />
      </div>
    </li>
  );
}
