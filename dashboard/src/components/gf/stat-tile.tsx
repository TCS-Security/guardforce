import { cn } from "cn";
import type { Tone } from "@/lib/domain/status";
import { Eyebrow } from "./eyebrow";

const TONE_TEXT: Record<Tone, string> = {
  present: "text-present",
  "half-day": "text-half-day-foreground dark:text-half-day",
  absent: "text-absent",
  "on-leave": "text-on-leave",
  neutral: "text-foreground",
  signal: "text-signal",
  olive: "text-primary",
};

/**
 * Big-number tile. Numbers are set in the display face with tabular figures; the
 * label is a mono eyebrow. Use `tone` sparingly — only for the value's meaning.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
  style,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("reveal flex flex-col justify-between gap-3 rounded-lg border bg-card p-4", className)}
      style={style}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="flex items-end justify-between gap-3">
        <div className={cn("font-display tabular text-[34px] leading-none font-semibold tracking-tight", TONE_TEXT[tone])}>{value}</div>
        {children}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
