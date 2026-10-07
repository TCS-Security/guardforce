import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "@/lib/auth/session";
import { Brand } from "./brand";
import { NavScroll, SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { Clock } from "./clock";
import { AlertsBell } from "./alerts-bell";
import { loadRecentAlerts } from "@/lib/data/alerts";

export async function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const alerts = await loadRecentAlerts();
  const permissions = [...session.permissions];
  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-dvh">
        {/*
          The panel stretches to the full height of the page (so it never ends partway down a long
          page, a full-page screenshot or a print); the column inside it is sticky and exactly one
          screen tall, so the nav scrolls on its own and the agency footer stays pinned.
        */}
        <aside aria-label="Main navigation" className="grain hidden w-[232px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
          <div className="sticky top-0 z-10 flex h-dvh flex-col">
            <div className="flex h-14 shrink-0 items-center px-5">
              <Brand />
            </div>
            <NavScroll className="px-2 pt-1 pb-4">
              <SidebarNav permissions={permissions} />
            </NavScroll>
            <div className="shrink-0 border-t border-sidebar-border px-5 py-3">
              <div className="eyebrow text-sidebar-foreground/45">Agency</div>
              <div className="truncate text-[13px] font-medium">{session.agency.name}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/55">
                {session.role?.name ?? "Guard"}{session.agency.status === "trial" ? " · trial" : ""}
              </div>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <MobileNav permissions={permissions} />
            <Brand className="lg:hidden" compact />
            <div className="hidden sm:block">
              <Clock tz={session.agency.timezone} />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <AlertsBell initial={alerts} />
              <UserMenu name={session.profile.full_name} role={session.role?.name ?? "Guard"} email={session.profile.email} />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
