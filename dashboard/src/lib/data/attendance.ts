import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";

export type AttendanceFilters = {
  date: string;
  siteId: string | null;
  attendance: string | null;
  trust: string | null;
  q: string | null;
};

export type AttendanceRow = {
  id: string;
  shift_date: string;
  status: string;
  attendance: string;
  trust: string | null;
  flags: string[];
  late_by_min: number;
  worked_minutes: number;
  away_seconds: number;
  location_enabled: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  start_captured_at: string | null;
  end_captured_at: string | null;
  exception_id: string | null;
  override_attendance: string | null;
  guards: { id: string; full_name: string; employee_code: string | null } | null;
  sites: { id: string; name: string } | null;
  shift_types: { name: string } | null;
};

/** The attendance day view (F4 + F9): one row per shift, with the filters applied server-side. */
export async function loadAttendanceDay(session: Session, filters: AttendanceFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("shifts")
    .select(
      "id,shift_date,status,attendance,trust,flags,late_by_min,worked_minutes,away_seconds,location_enabled,scheduled_start,scheduled_end,started_at,ended_at,start_captured_at,end_captured_at,exception_id,override_attendance,guards(id,full_name,employee_code),sites(id,name),shift_types(name)",
    )
    .eq("shift_date", filters.date)
    .order("scheduled_start");

  if (filters.siteId) query = query.eq("site_id", filters.siteId);
  if (filters.attendance) query = query.eq("attendance", filters.attendance as never);
  if (filters.trust) query = query.eq("trust", filters.trust as never);

  const [{ data }, { data: sites }] = await Promise.all([
    query,
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
  ]);

  let rows = (data ?? []) as unknown as AttendanceRow[];
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((r) => [r.guards?.full_name, r.guards?.employee_code].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }

  const summary = rows.reduce(
    (acc, r) => {
      acc[r.attendance as keyof typeof acc] = (acc[r.attendance as keyof typeof acc] ?? 0) + 1;
      if (r.trust === "flagged" || r.trust === "suspicious") acc.flagged += 1;
      if (r.status === "in_progress") acc.on_duty += 1;
      if (r.status === "void_location_off") acc.void += 1;
      return acc;
    },
    { present: 0, half_day: 0, absent: 0, on_leave: 0, pending: 0, flagged: 0, on_duty: 0, void: 0 },
  );

  return { rows, sites: sites ?? [], summary };
}

/** Everything the shift detail page shows, including the breadcrumb trail. */
export async function loadShift(session: Session, shiftId: string) {
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("shifts")
    .select(
      "*,guards(id,full_name,employee_code,designation,phone),sites(id,name,lat,lng,fence_type,radius_m,polygon,leeway_m),shift_types(name,start_time,end_time)",
    )
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift) return null;

  const [pings, events, exception, audit] = await Promise.all([
    supabase
      .from("location_pings")
      .select("recorded_at,lat,lng,accuracy_m,battery_pct,in_fence,distance_m,is_mock")
      .eq("shift_id", shiftId)
      .order("recorded_at"),
    supabase.from("events").select("id,type,severity,title,payload,created_at").eq("shift_id", shiftId).order("created_at"),
    shift.exception_id
      ? supabase.from("shift_exceptions").select("*,profiles(full_name)").eq("id", shift.exception_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("audit_logs").select("id,action,reason,before,after,created_at,profiles(full_name)").eq("entity_type", "shift").eq("entity_id", shiftId).order("created_at", { ascending: false }),
  ]);

  return {
    shift,
    pings: pings.data ?? [],
    events: events.data ?? [],
    exception: exception.data as { reason: string; category: string; created_at: string; profiles: { full_name: string } | null } | null,
    audit: audit.data ?? [],
  };
}

export type ShiftDetail = NonNullable<Awaited<ReturnType<typeof loadShift>>>;

export function defaultAttendanceDate(session: Session) {
  return toLocalDate(new Date(), session.agency.timezone);
}
