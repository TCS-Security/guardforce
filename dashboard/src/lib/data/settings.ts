import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";

/** Team roster: every profile in the agency, with a supervisor's site scope resolved. */
export async function loadTeam(session: Session) {
  const supabase = await createClient();
  const [{ data: profiles }, { data: scopes }, { data: sites }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,phone,role,is_active,created_at").eq("agency_id", session.agency.id).order("full_name"),
    supabase.from("supervisor_sites").select("profile_id,site_id,sites(name)"),
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
  ]);
  const scopeByProfile = new Map<string, { site_id: string; name: string }[]>();
  for (const s of scopes ?? []) {
    const list = scopeByProfile.get(s.profile_id) ?? [];
    list.push({ site_id: s.site_id, name: s.sites?.name ?? "—" });
    scopeByProfile.set(s.profile_id, list);
  }
  const team = (profiles ?? []).map((p) => ({ ...p, sites: scopeByProfile.get(p.id) ?? [] }));
  return { team, sites: sites ?? [] };
}

/** The signed-in user's own notification preferences (created on first visit if missing). */
export async function loadNotificationPreferences(session: Session) {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_preferences").select("*").eq("profile_id", session.userId).maybeSingle();
  if (data) return data;
  return {
    profile_id: session.userId,
    agency_id: session.agency.id,
    late_start: true,
    fence_exit: true,
    location_off: true,
    outage: true,
    patrol_missed: true,
    leave_requests: true,
    daily_digest: true,
    whatsapp_number: null as string | null,
    updated_at: new Date().toISOString(),
  };
}

/** Agency-wide notification outbox (owner/admin only — see notifications_select_owner RLS policy). */
export async function loadNotificationOutbox(limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,channel,title,body,status,created_at,sent_at,read_at,recipient_profile_id,recipient_guard_id,profiles(full_name),guards(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => ({ ...n, recipient_name: n.profiles?.full_name ?? n.guards?.full_name ?? "—" }));
}

/** Guard-app remote config + the devices reporting in. */
export async function loadAppConfig(session: Session) {
  const supabase = await createClient();
  const [{ data: config }, { data: devices }] = await Promise.all([
    supabase.from("app_config").select("*").eq("agency_id", session.agency.id).maybeSingle(),
    supabase
      .from("devices")
      .select("id,platform,device_model,os_version,app_version,bundle_version,last_seen_at,guards(full_name),profiles(full_name)")
      .order("last_seen_at", { ascending: false })
      .limit(200),
  ]);
  return {
    config: config ?? {
      agency_id: session.agency.id,
      min_app_version: "1.0.0",
      ota_channel: "production",
      ping_interval_moving_s: 120,
      ping_interval_stationary_s: 900,
      selfie_max_kb: 120,
      photo_max_kb: 250,
      features: {},
      updated_at: new Date().toISOString(),
    },
    devices: (devices ?? []).map((d) => ({ ...d, holder_name: d.guards?.full_name ?? d.profiles?.full_name ?? "—" })),
  };
}

export type AuditLogFilters = { entityType: string | null; actorId: string | null; from: string | null; to: string | null };

/** Audit log viewer rows, newest first, with the actor's name resolved. */
export async function loadAuditLogs(filters: AuditLogFilters, limit = 200) {
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("id,entity_type,entity_id,action,reason,before,after,created_at,profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.actorId) q = q.eq("actor_id", filters.actorId);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59Z`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, actor_name: r.profiles?.full_name ?? "System" }));
}

/** Distinct entity types + actors seen in the audit log, for the filter selects. */
export async function loadAuditLogFacets() {
  const supabase = await createClient();
  const [{ data: entityRows }, { data: actors }] = await Promise.all([
    supabase.from("audit_logs").select("entity_type").limit(2000),
    supabase.from("profiles").select("id,full_name").order("full_name"),
  ]);
  const entityTypes = [...new Set((entityRows ?? []).map((r) => r.entity_type))].sort();
  return { entityTypes, actors: actors ?? [] };
}
