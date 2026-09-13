import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { EVENT_META } from "@/lib/domain/status";
import type { EventType } from "@/lib/supabase/types";

export type EventFilters = {
  siteId: string | null;
  guardId: string | null;
  group: string | null;
  type: string | null;
  severity: string | null;
  from: string | null;
  to: string | null;
  ack: "all" | "open" | "acknowledged";
  page: number;
};

export const EVENTS_PAGE_SIZE = 50;

/** Turns URL search params into the filter object. Pure, so it can be unit tested. */
export function parseEventFilters(sp: Record<string, string | string[] | undefined>, today: string): EventFilters {
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
  const ack = str(sp.ack);
  return {
    siteId: str(sp.site),
    guardId: str(sp.guard),
    group: str(sp.group),
    type: str(sp.type),
    severity: str(sp.severity),
    from: str(sp.from) ?? today,
    to: str(sp.to) ?? today,
    ack: ack === "open" || ack === "acknowledged" ? ack : "all",
    page: Math.max(1, Number(str(sp.page) ?? 1) || 1),
  };
}

/** Event types belonging to a group ("attendance", "location", …). */
export function typesInGroup(group: string): EventType[] {
  return (Object.keys(EVENT_META) as EventType[]).filter((t) => EVENT_META[t].group === group);
}

export async function loadEvents(session: Session, filters: EventFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(
      "id,type,severity,title,payload,created_at,site_id,guard_id,shift_id,acknowledged_at,acknowledged_by,sites(name),guards(full_name,employee_code)",
      { count: "exact" },
    )
    .gte("created_at", `${filters.from}T00:00:00+05:30`)
    .lte("created_at", `${filters.to}T23:59:59+05:30`)
    .order("created_at", { ascending: false });

  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.guardId) query = query.eq("guard_id", filters.guardId);
  if (filters.severity) query = query.eq("severity", filters.severity as never);
  if (filters.type) query = query.eq("type", filters.type as never);
  else if (filters.group) query = query.in("type", typesInGroup(filters.group));
  if (filters.ack === "open") query = query.is("acknowledged_at", null);
  if (filters.ack === "acknowledged") query = query.not("acknowledged_at", "is", null);

  const from = (filters.page - 1) * EVENTS_PAGE_SIZE;
  const { data, count } = await query.range(from, from + EVENTS_PAGE_SIZE - 1);

  const [{ data: sites }, { data: guards }] = await Promise.all([
    supabase.from("sites").select("id,name").order("name"),
    supabase.from("guards").select("id,full_name").neq("status", "inactive").order("full_name"),
  ]);

  return {
    rows: (data ?? []) as unknown as EventRow[],
    total: count ?? 0,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / EVENTS_PAGE_SIZE)),
    sites: sites ?? [],
    guards: guards ?? [],
  };
}

export type EventRow = {
  id: string;
  type: EventType;
  severity: "info" | "warn" | "critical";
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  site_id: string | null;
  guard_id: string | null;
  shift_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  sites: { name: string } | null;
  guards: { full_name: string; employee_code: string | null } | null;
};
