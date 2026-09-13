import { cn } from "cn";
import type { Tone } from "@/lib/domain/status";

const TONE_CLASSES: Record<Tone, string> = {
  present: "bg-present/12 text-present border-present/25",
  "half-day": "bg-half-day/18 text-half-day-foreground border-half-day/40 dark:text-half-day",
  absent: "bg-absent/12 text-absent border-absent/25",
  "on-leave": "bg-on-leave/12 text-on-leave border-on-leave/25",
  neutral: "bg-muted text-muted-foreground border-border",
  signal: "bg-signal/12 text-signal border-signal/30",
  olive: "bg-primary/10 text-primary border-primary/25",
};

const DOT_CLASSES: Record<Tone, string> = {
  present: "bg-present",
  "half-day": "bg-half-day",
  absent: "bg-absent",
  "on-leave": "bg-on-leave",
  neutral: "bg-muted-foreground/60",
  signal: "bg-signal",
  olive: "bg-primary",
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  pulse = false,
  className,
  size = "sm",
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  size?: "xs" | "sm";
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "xs" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOT_CLASSES[tone], pulse && "pulse-dot")} />}
      {children}
    </span>
  );
}

export function ToneDot({ tone, className, pulse }: { tone: Tone; className?: string; pulse?: boolean }) {
  return <span className={cn("inline-block size-2 rounded-full", DOT_CLASSES[tone], pulse && "pulse-dot", className)} />;
}
