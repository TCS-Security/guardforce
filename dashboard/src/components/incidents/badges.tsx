import { StatusPill } from "@/components/gf/status-pill";
import { INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, POSITION_STATE, type PositionState } from "@/lib/domain/incidents";
import type { IncidentSeverity, IncidentStatus, IncidentType } from "@/lib/supabase/types";

export function IncidentSeverityBadge({ severity, size }: { severity: IncidentSeverity; size?: "xs" | "sm" }) {
  const m = INCIDENT_SEVERITY[severity];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}

export function IncidentStatusBadge({ status, size }: { status: IncidentStatus; size?: "xs" | "sm" }) {
  const m = INCIDENT_STATUS[status];
  return <StatusPill tone={m.tone} size={size} pulse={status === "open"}>{m.label}</StatusPill>;
}

export function IncidentTypeBadge({ type, size }: { type: IncidentType; size?: "xs" | "sm" }) {
  return <StatusPill tone="neutral" size={size} dot={false}>{INCIDENT_TYPE[type].label}</StatusPill>;
}

export function PositionStateBadge({ state, size = "xs" }: { state: PositionState; size?: "xs" | "sm" }) {
  const m = POSITION_STATE[state];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}
