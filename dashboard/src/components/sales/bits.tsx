import { Flame, Snowflake, Sun } from "lucide-react";
import { cn } from "cn";
import { StatusPill } from "@/components/gf/status-pill";
import { LABEL_META, SEGMENTS, sortNumbers, type Label, type Segment } from "@/lib/domain/sales";

const LABEL_ICON = { hot: Flame, warm: Sun, cold: Snowflake } as const;

export function LabelPill({ label, size = "sm", className }: { label: Label; size?: "xs" | "sm"; className?: string }) {
  const meta = LABEL_META[label];
  const Icon = LABEL_ICON[label];
  return (
    <StatusPill tone={meta.tone} size={size} dot={false} className={cn("uppercase tracking-wide", className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </StatusPill>
  );
}

export function segmentLabel(segment: string) {
  return SEGMENTS[segment as Segment]?.label ?? segment;
}

/** The number to show in a list row: the best working phone, contact or main line. */
export function bestPhone(nums: { value: string; kind: "mobile" | "office" | "email"; status: "unknown" | "worked" | "no_answer" | "wrong" }[]) {
  return sortNumbers(nums.filter((n) => n.kind !== "email" && n.status !== "wrong"))[0]?.value ?? null;
}

/** Software word for the current agency. */
export const SOFTWARE_TEXT: Record<string, { text: string; tone: "present" | "half-day" | "absent" | "neutral" }> = {
  none: { text: "no app", tone: "present" },
  weak: { text: "basic tech only", tone: "present" },
  strong: { text: "has guard software", tone: "absent" },
  national: { text: "national firm", tone: "absent" },
};
