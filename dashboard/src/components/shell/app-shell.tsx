import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "@/lib/auth/session";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { Clock } from "./clock";
import { AlertsBell } from "./alerts-bell";

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh">
        <aside className="grain sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <div className="relative z-10 flex h-14 items-center px-5">
            <Brand />
          </div>
          <div className="relative z-10 flex-1 overflow-y-auto px-2 pb-4">
            <SidebarNav />
          </div>
          <div className="relative z-10 border-t border-sidebar-border px-5 py-3">
            <div className="eyebrow text-sidebar-foreground/45">Agency</div>
            <div className="truncate text-[13px] font-medium">{session.agency.name}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/55">{session.agency.city ?? ""}</div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <MobileNav />
            <Brand className="lg:hidden" compact />
            <div className="hidden sm:block">
              <Clock tz={session.agency.timezone} />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <AlertsBell />
              <UserMenu name={session.profile.full_name} role={session.profile.role} email={session.profile.email} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
