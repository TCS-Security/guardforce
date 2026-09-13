"use client";

import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useSyncExternalStore } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { signOut } from "@/app/(auth)/login/actions";

/** The theme lives on <html>, so read it from there rather than mirroring it in state. */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function UserMenu({ name, role, email }: { name: string; role: string; email: string | null }) {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("gf-theme", next ? "dark" : "light"); } catch {}
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 items-center gap-2 rounded-md px-1.5 text-left hover:bg-muted"
        aria-label="Account menu"
      >
        <GuardAvatar name={name} size="sm" />
        <span className="hidden text-sm leading-tight sm:block">
          <span className="block font-medium">{name}</span>
          <span className="block text-[11px] capitalize text-muted-foreground">{role}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme}>
          {dark ? <Sun /> : <Moon />} {dark ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem nativeButton={false} render={<a href="/settings/profile" />}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
