import Link from "next/link";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import type { CrewGuard } from "@/lib/preview/crew";

/** Avatar, linked name, and the employee code or site underneath. */
export function GuardCell({ guard, sub }: { guard: CrewGuard; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <GuardAvatar name={guard.full_name} size="sm" />
      <div className="min-w-0">
        <Link href={`/guards/${guard.id}`} className="block truncate font-medium hover:underline">{guard.full_name}</Link>
        <div className="truncate text-xs text-muted-foreground">
          {sub ?? (guard.employee_code ? <Mono className="text-xs">{guard.employee_code}</Mono> : guard.site_name ?? "No site")}
        </div>
      </div>
    </div>
  );
}
