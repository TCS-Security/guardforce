import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import type { Tables } from "@/lib/supabase/types";
import { toLocalDate } from "@/lib/domain/format";
import { nearestSite, type Label, type Segment, type Stage } from "@/lib/domain/sales";

export type LeadRow = Tables<"leads"> & {
  owner: { id: string; full_name: string } | null;
  lead_numbers: { value: string; kind: "mobile" | "office" | "email"; status: "unknown" | "worked" | "no_answer" | "wrong"; contact_id: string | null }[];
};

export type SalesFilters = {
  label: Label | null;
  segment: Segment | null;
  stage: Stage | null;
  owner: string | null;
  q: string | null;
};

export type SalesTab = "today" | "leads" | "find";

const LEAD_COLUMNS =
  "*, owner:profiles!leads_owner_id_fkey(id,full_name), lead_numbers(value,kind,status,contact_id)";

const LABEL_RANK: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

/** The agency's own sites, for "near your site". */
async function loadAgencySites(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("sites").select("id,name,lat,lng").eq("is_active", true);
  return (data ?? []) as { id: string; name: string; lat: number; lng: number }[];
}

/** People who can own a lead: the agency's dashboard users. */
async function loadTeam(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("profiles").select("id,full_name").neq("role", "guard").eq("is_active", true).order("full_name");
  return (data ?? []) as { id: string; full_name: string }[];
}

/** List and board: the agency's leads with filters. */
export async function loadLeads(session: Session, filters: SalesFilters, tab: SalesTab) {
  const supabase = await createClient();
  let query = supabase.from("leads").select(LEAD_COLUMNS).limit(500);
  if (filters.label) query = query.eq("label", filters.label);
  if (filters.segment) query = query.eq("segment", filters.segment);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.owner === "me") query = query.eq("owner_id", session.userId);
  else if (filters.owner === "none") query = query.is("owner_id", null);
  else if (filters.owner) query = query.eq("owner_id", filters.owner);
  if (filters.q) {
    const q = filters.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`name.ilike.%${q}%,locality.ilike.%${q}%,incumbent_agency.ilike.%${q}%`);
  }
  const today = toLocalDate(new Date(), session.agency.timezone);
  if (tab === "today") query = query.lte("next_follow_up", today).not("stage", "in", "(won,lost)");

  const [{ data, error }, team, sites] = await Promise.all([query, loadTeam(supabase), loadAgencySites(supabase)]);
  if (error) throw new Error(`Could not load leads: ${error.message}`);
  const rows = ((data ?? []) as unknown as LeadRow[]).sort((a, b) => {
    if (tab === "today") return (a.next_follow_up ?? "").localeCompare(b.next_follow_up ?? "") || LABEL_RANK[a.label]! - LABEL_RANK[b.label]!;
    return (
      LABEL_RANK[a.label]! - LABEL_RANK[b.label]! ||
      (a.next_follow_up ?? "9999").localeCompare(b.next_follow_up ?? "9999") ||
      a.name.localeCompare(b.name)
    );
  });

  const counts = await loadCounts(supabase, today);
  return { rows, team, sites, today, counts };
}

async function loadCounts(supabase: Awaited<ReturnType<typeof createClient>>, today: string) {
  const [{ count: total }, { count: hot }, { count: due }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).not("stage", "in", "(won,lost)"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("label", "hot").not("stage", "in", "(won,lost)"),
    supabase.from("leads").select("id", { count: "exact", head: true }).lte("next_follow_up", today).not("stage", "in", "(won,lost)"),
  ]);
  return { open: total ?? 0, hot: hot ?? 0, due: due ?? 0 };
}

export type ProspectRow = Tables<"prospects"> & { near: { name: string; meters: number } | null };

/** "Find new leads": shared prospects this agency hasn't added yet, best first. */
export async function loadProspects(filters: SalesFilters & { near: boolean }) {
  const supabase = await createClient();
  const [{ data, error }, sites] = await Promise.all([
    supabase.rpc("sales_find_prospects", {
      p_segment: filters.segment && filters.segment !== "agency" ? filters.segment : undefined,
      p_label: filters.label ?? undefined,
      p_q: filters.q ?? undefined,
      p_limit: filters.near ? 1000 : 200,
    }),
    loadAgencySites(supabase),
  ]);
  if (error) throw new Error(`Could not load new leads: ${error.message}`);
  let rows: ProspectRow[] = ((data ?? []) as Tables<"prospects">[]).map((p) => {
    const n = nearestSite(p, sites);
    return { ...p, near: n ? { name: n.site.name, meters: n.meters } : null };
  });
  if (filters.near) rows = rows.filter((r) => r.near && r.near.meters <= 3000).sort((a, b) => a.near!.meters - b.near!.meters);
  return { rows: rows.slice(0, 200), hasSites: sites.length > 0 };
}

export type LeadContact = Tables<"lead_contacts">;
export type LeadNumber = Omit<Tables<"lead_numbers">, "kind" | "status"> & {
  kind: "mobile" | "office" | "email";
  status: "unknown" | "worked" | "no_answer" | "wrong";
};
export type LeadActivity = Tables<"lead_activities"> & { author: { full_name: string } | null };

export type LeadDetail = {
  lead: Tables<"leads"> & { owner: { id: string; full_name: string } | null };
  contacts: LeadContact[];
  numbers: LeadNumber[];
  activities: LeadActivity[];
  near: { site: { id: string; name: string }; meters: number } | null;
  nearbySites: { id: string; name: string; lat: number; lng: number }[];
  lookupsThisMonth: number;
};

/** Everything the lead card shows. Null when the lead doesn't exist or isn't visible. */
export async function loadLead(session: Session, id: string): Promise<LeadDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const monthStart = `${toLocalDate(new Date(), session.agency.timezone).slice(0, 7)}-01T00:00:00+05:30`;
  const [{ data: lead }, { data: contacts }, { data: numbers }, { data: activities }, sites, { count: lookups }] = await Promise.all([
    supabase.from("leads").select("*, owner:profiles!leads_owner_id_fkey(id,full_name)").eq("id", id).maybeSingle(),
    supabase.from("lead_contacts").select("*").eq("lead_id", id).order("created_at"),
    supabase.from("lead_numbers").select("*").eq("lead_id", id).order("created_at"),
    supabase
      .from("lead_activities")
      .select("*, author:profiles!lead_activities_created_by_fkey(full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    loadAgencySites(supabase),
    supabase.from("lead_lookups").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
  ]);
  if (!lead) return null;
  const near = nearestSite(lead, sites);
  const nearbySites =
    lead.lat != null && lead.lng != null && near
      ? sites.filter((s) => (nearestSite(lead, [s])?.meters ?? Infinity) <= 5000)
      : [];
  return {
    lead: lead as LeadDetail["lead"],
    contacts: (contacts ?? []) as LeadContact[],
    numbers: (numbers ?? []) as LeadNumber[],
    activities: (activities ?? []) as unknown as LeadActivity[],
    near,
    nearbySites,
    lookupsThisMonth: lookups ?? 0,
  };
}

export { loadTeam as loadSalesTeam };
