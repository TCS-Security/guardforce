import { cn } from "cn";

/** Wordmark: a shield-notch glyph and the name in the display face. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden className="shrink-0">
        <path d="M13 2 3.5 5.5v6.2c0 5.6 4 10.4 9.5 12.3 5.5-1.9 9.5-6.7 9.5-12.3V5.5L13 2Z" fill="var(--sidebar-primary)" />
        <path d="M13 2v22c5.5-1.9 9.5-6.7 9.5-12.3V5.5L13 2Z" fill="oklch(0 0 0 / 0.18)" />
        <path d="M8.5 13.2 11.6 16.3 17.6 9.9" stroke="var(--sidebar-primary-foreground)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-tight">
          Guard<span className="opacity-70">Force</span>
        </span>
      )}
    </div>
  );
}
