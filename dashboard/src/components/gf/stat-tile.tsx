import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
 *
 * Pass `href` to make the whole tile a link to the list behind the number: it
 * becomes a real anchor (keyboard reachable, focus ring, hover state) rather than
 * a div wrapped in one at the call site.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  linkLabel,
  className,
  style,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  /** Where the number's underlying rows live. */
  href?: string;
  /** Accessible name for the link when the visible label isn't enough. */
  linkLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {href && (
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100"
          />
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className={cn("font-display tabular text-[34px] leading-none font-semibold tracking-tight", TONE_TEXT[tone])}>{value}</div>
        {children}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  const base = "reveal flex flex-col justify-between gap-3 rounded-lg border bg-card p-4";

  if (!href) {
    return (
      <div className={cn(base, className)} style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-label={linkLabel}
      className={cn(
        base,
        "group/tile cursor-pointer transition-colors outline-none",
        "hover:border-primary/40 hover:bg-muted/40",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      style={style}
    >
      {body}
    </Link>
  );
}
