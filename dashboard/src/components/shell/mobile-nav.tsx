"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavScroll, SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";

export function MobileNav({ permissions }: { permissions: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
        <Menu />
      </SheetTrigger>
      {/* Brand stays put; the list scrolls, since it no longer fits on a phone screen. */}
      <SheetContent side="left" className="w-64 gap-0 bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand className="shrink-0 px-6 pt-5 pb-4 text-sidebar-foreground" />
        <NavScroll className="px-2 pt-1 pb-6">
          <SidebarNav onNavigate={() => setOpen(false)} permissions={permissions} />
        </NavScroll>
      </SheetContent>
    </Sheet>
  );
}
