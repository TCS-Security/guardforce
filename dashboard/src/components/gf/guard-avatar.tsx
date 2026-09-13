import { cn } from "cn";
import { initials } from "@/lib/domain/format";

const HUES = [135, 78, 250, 35, 190, 300, 20, 160];

function hueFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length]!;
}

/** Initials avatar tinted deterministically from the name. */
export function GuardAvatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const dim = { xs: "size-6 text-[10px]", sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-20 text-xl" }[size];
  const hue = hueFor(name);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold ring-1 ring-black/5 dark:ring-white/10", dim, className)}
      style={{ background: `oklch(0.90 0.05 ${hue})`, color: `oklch(0.36 0.09 ${hue})` }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
