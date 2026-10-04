import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { monthGridDays, weekDays } from "@/lib/domain/roster";
import { kycGaps } from "@/lib/domain/kyc";

export type RosterShift = {
  id: string;
  guard_id: string;
  shift_type_id: string | null;
  shift_date: string;
  status: string;
  attendance: string;
  started_at: string | null;
  assignment_id: string | null;
  guards: { id: string; full_name: string; employee_code: string | null } | null;
};

/**
 * Roster for a site across an explicit run of days. The shifts come back in one
 * ranged query whatever the span, so a month costs the same round trips as a week
 * (never a query per day). `withGuards` is the assignable-guard list the week
 * board's assign dialog needs; the month grid is read-only and skips it.
 */
async function loadRosterRange(session: Session, siteId: string, days: string[], { withGuards = true } = {}) {
  const supabase = await createClient();
  const from = days[0]!;
  const to = days.at(-1)!;
  const [site, shiftTypes, shifts, patterns, guards] = await Promise.all([
    supabase.from("sites").select("id,name,guards_required").eq("id", siteId).maybeSingle(),
    supabase.from("shift_types").select("*").eq("site_id", siteId).eq("is_active", true).order("start_time"),
    supabase
      .from("shifts")
      .select("id,guard_id,shift_type_id,shift_date,status,attendance,started_at,assignment_id,guards(id,full_name,employee_code)")
      .eq("site_id", siteId)
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date"),
    supabase
      .from("roster_patterns")
      .select("id,guard_id,shift_type_id,weekdays,starts_on,ends_on,guards(full_name,employee_code),shift_types(name)")
      .eq("site_id", siteId)
      .order("created_at"),
    withGuards
      ? supabase
          .from("guards")
          .select("id,full_name,employee_code,designation,site_id,status,phone_verified_at,registration_selfie_path,guard_documents(type,status,file_path)")
          .neq("status", "inactive")
          .order("full_name")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const assignable = (guards.data ?? []).map((g) => ({
    id: g.id,
    full_name: g.full_name,
    employee_code: g.employee_code,
    designation: g.designation,
    is_home_site: g.site_id === siteId,
    status: g.status,
    kyc_gaps: kycGaps(g, g.guard_documents),
  }));

  return {
    site: site.data,
    days,
    shiftTypes: shiftTypes.data ?? [],
    shifts: (shifts.data ?? []) as unknown as RosterShift[],
    patterns: patterns.data ?? [],
    guards: assignable,
  };
}

/** One week of roster for a site: shift types down, days across. */
export async function loadRosterWeek(session: Session, siteId: string, anchor: Date) {
  return loadRosterRange(session, siteId, weekDays(anchor));
}

/**
 * One calendar month for a site, as the padded Monday-first grid the month board
 * renders — the padding days are queried too so the leading/trailing cells are
 * honest rather than blank.
 */
export async function loadRosterMonth(session: Session, siteId: string, anchor: Date) {
  return loadRosterRange(session, siteId, monthGridDays(anchor), { withGuards: false });
}

export type RosterWeek = Awaited<ReturnType<typeof loadRosterWeek>>;

export async function loadRosterSites(session: Session) {
  const supabase = await createClient();
  const { data } = await supabase.from("sites").select("id,name").eq("is_active", true).order("name");
  return data ?? [];
}
