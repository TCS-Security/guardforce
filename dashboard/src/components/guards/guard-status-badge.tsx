import { StatusPill } from "@/components/gf/status-pill";
import type { Tone } from "@/lib/domain/status";
import type { GuardStatus } from "@/lib/supabase/types";

export const GUARD_STATUS: Record<GuardStatus, { label: string; tone: Tone }> = {
  invited: { label: "Invited", tone: "neutral" },
  active: { label: "Active", tone: "present" },
  inactive: { label: "Inactive", tone: "absent" },
};

export function GuardStatusBadge({ status, size }: { status: GuardStatus; size?: "xs" | "sm" }) {
  const m = GUARD_STATUS[status];
  return <StatusPill tone={m.tone} size={size}>{m.label}</StatusPill>;
}
