import { cn } from "cn";

/** Key/value row list for detail panes. */
export function KvList({ items, className }: { items: { k: React.ReactNode; v: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y", className)}>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 py-2 text-sm">
          <dt className="text-muted-foreground">{it.k}</dt>
          <dd className="min-w-0 break-words">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}
