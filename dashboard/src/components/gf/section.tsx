import { cn } from "cn";

/** Card-like section with a compact header row. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  style,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={cn("reveal rounded-lg border bg-card", className)} style={style}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn(bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}
