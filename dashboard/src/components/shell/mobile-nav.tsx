"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";

export function MobileNav({ permissions }: { permissions: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-4 text-sidebar-foreground">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Brand className="mb-6 px-2 text-sidebar-foreground" />
        <SidebarNav onNavigate={() => setOpen(false)} permissions={permissions} />
      </SheetContent>
    </Sheet>
  );
}
