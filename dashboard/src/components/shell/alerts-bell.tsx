"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtAgo } from "@/lib/domain/format";
import { cn } from "cn";

type Item = { id: string; title: string; body: string | null; created_at: string; read_at: string | null; payload: Record<string, unknown> };

/** Unread in-app alerts (warn/critical events fanned out to managers). Realtime-refreshed. */
export function AlertsBell() {
  const [items, setItems] = useState<Item[]>([]);
  const supabase = createClient();

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,created_at,read_at,payload")
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(12);
    setItems((data ?? []) as Item[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("alerts-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = items.filter((i) => !i.read_at).length;

  async function markAllRead() {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString(), status: "read" }).in("id", ids);
    load();
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={`Alerts, ${unread} unread`} className="relative" />}>
        <Bell />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-signal font-mono text-[10px] font-semibold text-signal-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Alerts</div>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={markAllRead}>Mark all read</button>
        </div>
        <ul className="max-h-[380px] divide-y overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No alerts yet.</li>}
          {items.map((i) => (
            <li key={i.id} className={cn("px-3 py-2.5", !i.read_at && "bg-signal/[0.06]")}>
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", i.read_at ? "bg-transparent" : "bg-signal")} />
                <div className="min-w-0">
                  <div className="text-[13px] leading-snug font-medium">{i.title}</div>
                  {i.body && <div className="text-xs text-muted-foreground">{i.body}</div>}
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{fmtAgo(i.created_at)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t px-3 py-2 text-right">
          <Link href="/events" className="text-xs font-medium text-primary hover:underline">Open event feed →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
