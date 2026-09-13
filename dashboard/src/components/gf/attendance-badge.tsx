import { ATTENDANCE, SHIFT_STATUS, TRUST, PATROL_STATUS, TASK_STATUS, LEAVE_STATUS, DOCUMENT_STATUS } from "@/lib/domain/status";
import type { AttendanceStatus, ShiftStatus, TrustLevel, PatrolStatus, TaskStatus, LeaveStatus, DocumentStatus } from "@/lib/supabase/types";
import { StatusPill } from "./status-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AttendanceBadge({ status, size }: { status: AttendanceStatus; size?: "xs" | "sm" }) {
  const m = ATTENDANCE[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}

export function ShiftStatusBadge({ status, size }: { status: ShiftStatus; size?: "xs" | "sm" }) {
  const m = SHIFT_STATUS[status];
  return <StatusPill tone={m.tone} size={size} pulse={status === "in_progress"}>{m.label}</StatusPill>;
}

export function TrustBadge({ trust, size }: { trust: TrustLevel | null; size?: "xs" | "sm" }) {
  if (!trust) return <span className="text-xs text-muted-foreground">—</span>;
  const m = TRUST[trust];
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>
      </TooltipTrigger>
      <TooltipContent>{m.hint}</TooltipContent>
    </Tooltip>
  );
}

export function PatrolStatusBadge({ status, size }: { status: PatrolStatus; size?: "xs" | "sm" }) {
  const m = PATROL_STATUS[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}

export function TaskStatusBadge({ status, size }: { status: TaskStatus; size?: "xs" | "sm" }) {
  const m = TASK_STATUS[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}

export function LeaveStatusBadge({ status, size }: { status: LeaveStatus; size?: "xs" | "sm" }) {
  const m = LEAVE_STATUS[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}

export function DocumentStatusBadge({ status, size }: { status: DocumentStatus; size?: "xs" | "sm" }) {
  const m = DOCUMENT_STATUS[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}
