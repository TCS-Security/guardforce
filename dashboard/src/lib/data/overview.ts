import "server-only";
import { subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";

export async function loadOverview(session: Session) {
  const supabase = await createClient();
  const tz = session.agency.timezone;
  const today = toLocalDate(new Date(), tz);
  const from = toLocalDate(subDays(new Date(), 13), tz);

  // Sweep monitors (late starts, missed patrols, outages, no-shows) so the page is current.
  await supabase.rpc("run_monitors", { p_agency_id: session.agency.id });

  const [summary, trend, alerts, patrols, leave, presence, kycGaps] = await Promise.all([
    supabase.rpc("site_day_summary", { p_agency_id: session.agency.id, p_date: today }),
    supabase.rpc("attendance_trend", { p_agency_id: session.agency.id, p_from: from, p_to: today }),
    supabase
      .from("events")
      .select("id,type,severity,title,payload,created_at,site_id,guard_id,shift_id,acknowledged_at,sites(name),guards(full_name)")
      .in("severity", ["warn", "critical"])
      .order("created_at", { ascending: false })
      .limit(14),
    supabase
      .from("patrols")
      .select("status")
      .gte("expected_at", `${today}T00:00:00+05:30`)
      .lte("expected_at", new Date().toISOString()),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("guard_presence").select("guard_id,shift_id,last_seen_at,location_enabled,in_fence,battery_pct"),
    supabase.from("guards").select("id,full_name,phone_verified_at,registration_selfie_path,designation,status,guard_documents(type,status,file_path)").neq("status", "inactive"),
  ]);

  const sites = summary.data ?? [];
  const totals = sites.reduce(
    (acc, s) => ({
      scheduled: acc.scheduled + s.scheduled,
      present: acc.present + s.present,
      half_day: acc.half_day + s.half_day,
      absent: acc.absent + s.absent,
      on_leave: acc.on_leave + s.on_leave,
      flagged: acc.flagged + s.flagged,
      on_duty: acc.on_duty + s.on_duty_now,
      pending: acc.pending + s.pending,
      required: acc.required + s.guards_required,
    }),
    { scheduled: 0, present: 0, half_day: 0, absent: 0, on_leave: 0, flagged: 0, on_duty: 0, pending: 0, required: 0 },
  );

  const patrolCounts = (patrols.data ?? []).reduce(
    (acc, p) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  return {
    today,
    sites,
    totals,
    trend: trend.data ?? [],
    alerts: alerts.data ?? [],
    patrolCounts,
    pendingLeave: leave.count ?? 0,
    presence: presence.data ?? [],
    guards: kycGaps.data ?? [],
  };
}

export type OverviewData = Awaited<ReturnType<typeof loadOverview>>;
