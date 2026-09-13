"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "history", label: "History" },
  { value: "balances", label: "Balances" },
] as const;

/**
 * Tab bar driven by the `?tab=` search param: each trigger is a Link, and only
 * the active tab's (server-rendered) content is mounted.
 */
export function LeaveTabs({ tab, children }: { tab: string; children: React.ReactNode }) {
  const value = TABS.some((t) => t.value === tab) ? tab : "upcoming";
  return (
    <Tabs value={value} className="gap-4">
      <TabsList variant="line">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value} nativeButton={false} render={<Link href={`/leave?tab=${t.value}`} />}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value}>{children}</TabsContent>
    </Tabs>
  );
}
