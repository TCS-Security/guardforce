import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";
import { buildWhatsapp } from "@/lib/whatsapp/messages";
import { buildBotAlerts, type BotInput, type GuardWatch } from "@/lib/whatsapp/bot";

type Named = { name: string } | null;
type GuardRef = { full_name: string; phone: string | null } | null;

/**
 * Everything the WhatsApp bot screen shows. The alerts are built from real rows under RLS —
 * absences of the last three days, the latest incidents, guards on shift and how long since
 * their phone was heard from — and the delivery log is sample data around the real crew.
 */
export async function loadWhatsapp(session: Session) {
  const supabase = await createClient();
  const now = new Date();
  const today = toLocalDate(now, session.agency.timezone);
  const since = toLocalDate(new Date(now.getTime() - 3 * 86_400_000), session.agency.timezone);

  const [{ data: guards }, { data: staff }, { data: scopes }, { data: absent }, { data: incidents }, { data: presence }] = await Promise.all([
    supabase.from("guards").select("id,full_name,phone,sites(name)").neq("status", "inactive").order("full_name"),
    supabase.from("profiles").select("id,full_name,phone,role").in("role", ["staff", "owner"]).eq("is_active", true).order("full_name"),
    supabase.from("supervisor_sites").select("profile_id,sites(name)"),
    supabase.from("shifts").select("shift_date,guards(full_name,phone),sites(name),shift_types(name)").eq("attendance", "absent").gte("shift_date", since).lte("shift_date", today).order("shift_date", { ascending: false }),
    supabase.from("incidents").select("id,type,title,description,severity,occurred_at,sites(name),guards!incidents_guard_id_fkey(full_name,phone),profiles!incidents_reported_by_fkey(full_name,phone)").order("occurred_at", { ascending: false }).limit(4),
    supabase.from("guard_presence").select("guard_id,last_seen_at,in_fence,shift_id,guards(full_name,phone),sites(name),shifts(shift_types(name))").not("shift_id", "is", null),
  ]);

  const crew = (guards ?? []).map(({ sites: s, ...g }) => ({ ...g, site_name: (s as Named)?.name ?? null }));
  const supervisors = (staff ?? []).map((p) => ({
    name: p.full_name, phone: p.phone, role: p.role,
    sites: (scopes ?? []).filter((x) => x.profile_id === p.id).map((x) => (x.sites as Named)?.name ?? "").filter(Boolean),
  }));
  // Field supervisors first; the owner is the fallback for sites nobody is scoped to.
  supervisors.sort((a, b) => Number(a.role === "owner") - Number(b.role === "owner"));

  const groups = new Map<string, BotInput["absences"][number]>();
  for (const r of absent ?? []) {
    const site = (r.sites as Named)?.name ?? "Site";
    const shift = (r.shift_types as Named)?.name ?? "Day";
    const key = `${r.shift_date}|${site}|${shift}`;
    const g = r.guards as GuardRef;
    const entry = groups.get(key) ?? { site, shift, date: r.shift_date, guards: [] };
    entry.guards.push({ name: g?.full_name ?? "Guard", phone: g?.phone ?? null });
    groups.set(key, entry);
  }

  const watches: GuardWatch[] = (presence ?? []).map((p) => {
    const g = p.guards as GuardRef;
    const shift = (p.shifts as { shift_types: Named } | null)?.shift_types?.name ?? "current";
    return { guard_id: p.guard_id, name: g?.full_name ?? "Guard", phone: g?.phone ?? null, site: (p.sites as Named)?.name ?? "Site", shift, on_shift: true, last_seen_at: p.last_seen_at, in_fence: p.in_fence };
  });

  const alerts = buildBotAlerts({
    now,
    supervisors: supervisors.map(({ name, phone, sites }) => ({ name, phone, sites })),
    absences: [...groups.values()].slice(0, 3),
    incidents: (incidents ?? []).map((x) => {
      const by = (x.guards as GuardRef) ?? (x.profiles as GuardRef);
      return { id: x.id, type: x.type, title: x.title, description: x.description, severity: x.severity, site: (x.sites as Named)?.name ?? "Site", occurred_at: x.occurred_at, reporter: by?.full_name ?? null, reporter_phone: by?.phone ?? null };
    }),
    watches,
  });

  const log = buildWhatsapp(crew, (staff ?? []).filter((p) => p.role === "staff"), now, `${session.agency.id}:${today}`);
  return { now: now.toISOString(), alerts, supervisors, ...log };
}
