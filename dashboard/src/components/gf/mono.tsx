import { cn } from "cn";

/** Timestamps, ids, codes: mono face with tabular figures. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular text-[13px]", className)}>{children}</span>;
}
