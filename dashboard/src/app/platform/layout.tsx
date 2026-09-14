import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Brand } from "@/components/shell/brand";
import { Clock } from "@/components/shell/clock";
import { UserMenu } from "@/components/shell/user-menu";
import { StatusPill } from "@/components/gf/status-pill";

/**
 * The provider's console. Deliberately a different frame from the tenant dashboard:
 * a slim top bar instead of the sidebar, and a persistent "you are staff" mark, so
 * nobody mistakes a tenant's data for their own.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requirePlatformAdmin();
  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex h-14 max-w-[1300px] items-center gap-5 px-6">
            <Link href="/platform" className="text-sidebar-foreground">
              <Brand />
            </Link>
            <StatusPill tone="signal" size="xs" dot={false} className="border-signal/40 bg-signal/15 text-sidebar-foreground">
              Platform console
            </StatusPill>
            <nav className="ml-4 flex items-center gap-1 text-sm" aria-label="Platform">
              <Link href="/platform" className="rounded-md px-2.5 py-1 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">Tenants</Link>
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sidebar-foreground/70 sm:block"><Clock tz="Asia/Kolkata" /></span>
              <div className="[&_button]:hover:bg-sidebar-accent [&_span]:text-sidebar-foreground">
                <UserMenu name={admin.full_name} role={admin.role === "platform_owner" ? "Platform owner" : "Platform support"} email={admin.email} />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1300px] flex-1 px-6 py-6">{children}</main>
      </div>
    </TooltipProvider>
  );
}
