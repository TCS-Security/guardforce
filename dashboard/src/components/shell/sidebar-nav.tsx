"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV_GROUPS } from "./nav";
import { ROUTE_PERMISSION } from "@/lib/auth/permissions";

/**
 * The nav's own scroll area, shared by the desktop sidebar and the phone drawer. The list is
 * longer than a laptop screen, so it scrolls inside the panel; the soft fade at either edge says
 * there is more, and the thin scrollbar matches the dark panel instead of the OS default.
 */
export function NavScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      data-slot="nav-scroll"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain",
        "[scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]",
        "[mask-image:linear-gradient(to_bottom,transparent,black_10px,black_calc(100%-18px),transparent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Sidebar. Sections the user cannot read are omitted, not greyed out. */
export function SidebarNav({ onNavigate, permissions }: { onNavigate?: () => void; permissions: readonly string[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Bring the current page into view inside the scrolling list (deep links, short windows, and
  // the phone drawer opening on a page near the bottom). `nearest` leaves the window alone.
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  const allowed = new Set(permissions);
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      const key = ROUTE_PERMISSION[item.href];
      return !key || allowed.has(key);
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <nav ref={ref} className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="eyebrow mb-1.5 px-3 text-sidebar-foreground/45">{group.label}</div>
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-md px-3 text-[13.5px] transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100")} strokeWidth={1.75} />
                    <span>{item.label}</span>
                    {item.preview && (
                      <span className="ml-auto font-mono text-[9.5px] tracking-wider text-sidebar-foreground/40 uppercase" title="Runs on sample data for now">
                        Preview
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
