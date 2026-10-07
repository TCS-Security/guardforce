import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { initials } from "@/lib/domain/format";
import { cn } from "cn";

/** Visitor face: the captured photo if there is one, else a tinted initials tile. */
export function VisitorPhoto({ name, hue, src, size = "md" }: { name: string; hue: number; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "size-8 text-[11px]", md: "size-10 text-xs", lg: "size-20 text-xl" }[size];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-display font-semibold ring-1 ring-black/5", dim)}
      style={{ background: `oklch(0.9 0.04 ${hue})`, color: `oklch(0.38 0.08 ${hue})` }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

/** Name over a mono sub-line; for guards, people and companies in table cells. */
export function PersonCell({ name, sub, guard }: { name: string; sub?: React.ReactNode; guard?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {guard && <GuardAvatar name={name} size="sm" />}
      <div className="min-w-0">
        <div className="truncate font-medium">{name}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

/** Code chip: TWR-A, GF-MAIN, VIS-4631. */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Mono className={cn("rounded border bg-muted/60 px-1.5 py-px text-[11px] whitespace-nowrap", className)}>{children}</Mono>;
}

/** Battery level as a tiny gauge; under 20 % reads as a problem. */
export function Battery({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = pct < 20 ? "bg-absent" : pct < 40 ? "bg-half-day" : "bg-present";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Phone battery ${pct}%`}>
      <span className="relative inline-flex h-2.5 w-5 rounded-[3px] border border-foreground/40 p-px after:absolute after:top-1/2 after:-right-[3px] after:h-1 after:w-[2px] after:-translate-y-1/2 after:rounded-r-sm after:bg-foreground/40">
        <span className={cn("h-full rounded-[1px]", tone)} style={{ width: `${Math.max(6, pct)}%` }} />
      </span>
      <Mono className={cn("text-xs", pct < 20 && "text-absent")}>{pct}%</Mono>
    </span>
  );
}
