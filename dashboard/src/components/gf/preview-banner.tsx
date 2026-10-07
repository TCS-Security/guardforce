import { FlaskConical } from "lucide-react";
import { cn } from "cn";

/**
 * Hairline strip at the top of a screen that runs on sample data. Says plainly that
 * the rows are generated and that nothing done on the page is saved yet.
 */
export function PreviewBanner({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "reveal flex items-start gap-2.5 rounded-lg border border-dashed border-primary/35 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <FlaskConical className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
      <p>
        <span className="eyebrow mr-1.5 text-primary">Preview</span>
        Sample data built around your real guards and sites. Nothing you do on this screen is saved yet.
        {children && <> {children}</>}
      </p>
    </div>
  );
}
