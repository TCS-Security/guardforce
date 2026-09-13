import { cn } from "cn";
import { kycGaps, kycProgress, KYC_GAP_LABELS, type KycGap } from "@/lib/domain/kyc";
import { StatusPill } from "@/components/gf/status-pill";
import type { Guard, GuardDocument } from "@/lib/supabase/types";

type GuardLike = Pick<Guard, "phone_verified_at" | "registration_selfie_path" | "designation">;
type DocLike = Pick<GuardDocument, "type" | "status" | "file_path">;

/** Compact progress bar + "N missing" / "Complete" pill for the roster table. */
export function KycProgressCell({ guard, docs, className }: { guard: GuardLike; docs: DocLike[]; className?: string }) {
  const gaps = kycGaps(guard, docs);
  const pct = kycProgress(guard, docs);
  return (
    <div className={cn("flex min-w-[132px] items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", gaps.length === 0 ? "bg-present" : "bg-half-day")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {gaps.length === 0 ? (
        <StatusPill tone="present" size="xs" dot={false}>Complete</StatusPill>
      ) : (
        <StatusPill tone="half-day" size="xs">{gaps.length} missing</StatusPill>
      )}
    </div>
  );
}

/** "Cannot be rostered until: …" gap list for the KYC vault section. */
export function KycGapNotice({ gaps }: { gaps: KycGap[] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-present/25 bg-present/8 px-3 py-2 text-sm text-present">
        KYC complete — this guard can be rostered to a shift.
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-md border border-signal/30 bg-signal/8 px-3 py-2 text-sm text-signal">
      Cannot be rostered until: {gaps.map((g) => KYC_GAP_LABELS[g]).join(", ")}
    </div>
  );
}
