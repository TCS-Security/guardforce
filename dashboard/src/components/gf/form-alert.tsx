import { cn } from "cn";

/**
 * Inline form feedback. Always announced (role=alert / role=status) and carries a
 * stable test id so specs don't collide with Next's route announcer.
 */
export function FormAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "success" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-absent/30 bg-absent/8 text-absent",
    success: "border-present/30 bg-present/8 text-present",
    warning: "border-half-day/40 bg-half-day/10 text-half-day-foreground dark:text-half-day",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-testid={tone === "error" ? "form-error" : "form-status"}
      className={cn("rounded-md border px-3 py-2 text-sm", styles, className)}
    >
      {children}
    </div>
  );
}
