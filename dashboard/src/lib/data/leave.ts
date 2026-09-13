import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import type { LeaveBalance, LeaveStatus, LeaveType } from "@/lib/supabase/types";
import { toLocalDate } from "@/lib/domain/format";
import {
  balanceRemaining, leaveDays, monthBounds, monthGrid, staffingImpact,
  type ApprovedLeaveLite, type StaffingImpact,
} from "@/lib/domain/leave";

/* ---------------------------------------------------------------------------
 * Shared row shape (leave_requests + guard/site/decider embeds)
 * ------------------------------------------------------------------------- */

const LEAVE_SELECT =
  "id,guard_id,site_id,type,start_date,end_date,reason,status,decided_at,decision_note,decided_by,created_at," +
  "guards(full_name,employee_code,registration_selfie_path),sites(name)," +
  "profiles!leave_requests_decided_by_fkey(full_name)";

export type LeaveRow = {
  id: string;
  guard_id: string;
  guard_name: string | null;
  guard_code: string | null;
  guard_avatar: string | null;
  site_id: string | null;
  site_name: string | null;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  decided_at: string | null;
  decision_note: string | null;
  decided_by_name: string | null;
  created_at: string;
};

type RawLeave = {
  id: string;
  guard_id: string;
  site_id: string | null;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  decided_at: string | null;
  decision_note: string | null;
  decided_by: string | null;
  created_at: string;
  guards: { full_name: string; employee_code: string | null; registration_selfie_path: string | null } | null;
  sites: { name: string } | null;
  profiles: { full_name: string } | null;
};

function toRow(r: RawLeave): LeaveRow {
  return {
    id: r.id,
    guard_id: r.guard_id,
    guard_name: r.guards?.full_name ?? null,
    guard_code: r.guards?.employee_code ?? null,
    guard_avatar: r.guards?.registration_selfie_path ?? null,
    site_id: r.site_id,
    site_name: r.sites?.name ?? null,
    type: r.type,
    start_date: r.start_date,
    end_date: r.end_date,
    reason: r.reason,
    status: r.status,
    decided_at: r.decided_at,
    decision_note: r.decision_note,
    decided_by_name: r.profiles?.full_name ?? null,
    created_at: r.created_at,
  };
}

export function currentYear(session: Session): number {
  return Number(toLocalDate(new Date(), session.agency.timezone).slice(0, 4));
}

export function todayISO(session: Session): string {
  return toLocalDate(new Date(), session.agency.timezone);
}

/* ---------------------------------------------------------------------------
 * Inbox: pending requests with balances + staffing impact (F8)
 * ------------------------------------------------------------------------- */

export type PendingItem = LeaveRow & {
  days: number;
  remaining: number | null;
  total: number | null;
  impact: StaffingImpact;
};

export async function loadPendingInbox(session: Session): Promise<PendingItem[]> {
  const supabase = await createClient();
  const year = currentYear(session);

  const { data: pending } = await supabase
    .from("leave_requests")
    .select(LEAVE_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = ((pending ?? []) as unknown as RawLeave[]).map(toRow);
  if (rows.length === 0) return [];

  const minStart = rows.reduce((m, r) => (r.start_date < m ? r.start_date : m), rows[0]!.start_date);

  const [balances, approved] = await Promise.all([
    supabase.from("leave_balances").select("*").eq("year", year),
    supabase
      .from("leave_requests")
      .select("guard_id,site_id,start_date,end_date,guards(full_name)")
      .eq("status", "approved")
      .gte("end_date", minStart),
  ]);

  const byGuard = new Map<string, LeaveBalance>((balances.data ?? []).map((b) => [b.guard_id, b]));
  const approvedLite: ApprovedLeaveLite[] = (approved.data ?? []).map((a) => ({
    guard_id: a.guard_id,
    site_id: a.site_id,
    start_date: a.start_date,
    end_date: a.end_date,
    full_name: a.guards?.full_name ?? "Guard",
  }));

  return rows.map((r) => {
    const balance = byGuard.get(r.guard_id) ?? null;
    return {
      ...r,
      days: leaveDays(r.start_date, r.end_date),
      remaining: balanceRemaining(balance, r.type),
      total: r.type === "unpaid"
        ? null
        : r.type === "casual"
          ? (balance?.casual_total ?? 12)
          : (balance?.earned_total ?? 15),
      impact: staffingImpact(r, approvedLite),
    };
  });
}

/* ---------------------------------------------------------------------------
 * Upcoming: approved leave that hasn't fully elapsed
 * ------------------------------------------------------------------------- */

export async function loadUpcoming(session: Session): Promise<LeaveRow[]> {
  const supabase = await createClient();
  const today = todayISO(session);
  const { data } = await supabase
    .from("leave_requests")
    .select(LEAVE_SELECT)
    .eq("status", "approved")
    .gte("end_date", today)
    .order("start_date", { ascending: true });
  return ((data ?? []) as unknown as RawLeave[]).map(toRow);
}

/* ---------------------------------------------------------------------------
 * History: all requests, filterable + paginated
 * ------------------------------------------------------------------------- */

export const HISTORY_PAGE_SIZE = 12;

export type HistoryFilters = {
  status: "all" | LeaveStatus;
  type: "all" | LeaveType;
  siteId: "all" | string;
  guardId: "all" | string;
  from: string | null;
  to: string | null;
  page: number;
};

export async function loadHistory(session: Session, f: HistoryFilters) {
  const supabase = await createClient();
  let q = supabase.from("leave_requests").select(LEAVE_SELECT, { count: "exact" });
  if (f.status !== "all") q = q.eq("status", f.status);
  if (f.type !== "all") q = q.eq("type", f.type);
  if (f.siteId !== "all") q = q.eq("site_id", f.siteId);
  if (f.guardId !== "all") q = q.eq("guard_id", f.guardId);
  if (f.from) q = q.gte("end_date", f.from); // overlap semantics
  if (f.to) q = q.lte("start_date", f.to);

  // One query: PostgREST returns the exact count alongside the page window.
  const first = await q.order("created_at", { ascending: false }).range(0, HISTORY_PAGE_SIZE - 1);
  const total = first.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.min(Math.max(1, f.page), pageCount);

  const { data } =
    page === 1
      ? first
      : await q.order("created_at", { ascending: false }).range((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE - 1);

  return { rows: ((data ?? []) as unknown as RawLeave[]).map(toRow), total, page, pageCount };
}

/* ---------------------------------------------------------------------------
 * Balances: per guard for the current year (F8)
 * ------------------------------------------------------------------------- */

export type GuardBalance = {
  guard_id: string;
  name: string;
  code: string | null;
  avatar: string | null;
  site_name: string | null;
  status: string;
  balance: LeaveBalance | null;
};

export async function loadBalances(session: Session): Promise<GuardBalance[]> {
  const supabase = await createClient();
  const year = currentYear(session);
  const [guards, balances] = await Promise.all([
    supabase
      .from("guards")
      .select("id,full_name,employee_code,registration_selfie_path,status,sites(name)")
      .neq("status", "inactive")
      .order("full_name"),
    supabase.from("leave_balances").select("*").eq("year", year),
  ]);
  const byGuard = new Map<string, LeaveBalance>((balances.data ?? []).map((b) => [b.guard_id, b]));
  return (guards.data ?? []).map((g) => ({
    guard_id: g.id,
    name: g.full_name,
    code: g.employee_code,
    avatar: g.registration_selfie_path,
    site_name: g.sites?.name ?? null,
    status: g.status,
    balance: byGuard.get(g.id) ?? null,
  }));
}

/* ---------------------------------------------------------------------------
 * Options for forms/filters
 * ------------------------------------------------------------------------- */

export async function loadSiteOptions(session: Session): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("sites").select("id,name").eq("is_active", true).order("name");
  return data ?? [];
}

export type GuardOption = { id: string; label: string; site_name: string | null };

export async function loadGuardOptions(session: Session): Promise<GuardOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guards")
    .select("id,full_name,employee_code,status,sites(name)")
    .eq("status", "active")
    .order("full_name");
  return (data ?? []).map((g) => ({
    id: g.id,
    label: g.employee_code ? `${g.full_name} · ${g.employee_code}` : g.full_name,
    site_name: g.sites?.name ?? null,
  }));
}

/* ---------------------------------------------------------------------------
 * Calendar month (F8): approved + pending leave per day at a site
 * ------------------------------------------------------------------------- */

export type CalendarEntry = {
  leaveId: string;
  guardId: string;
  guardName: string;
  avatar: string | null;
  type: LeaveType;
  start: string;
  end: string;
  reason: string | null;
};

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  approved: CalendarEntry[];
  pending: CalendarEntry[];
  thinCover: boolean;
};

export async function loadCalendarMonth(
  session: Session,
  siteId: string,
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  const supabase = await createClient();
  const { from, to } = monthBounds(year, month);
  const { data } = await supabase
    .from("leave_requests")
    .select("id,guard_id,type,start_date,end_date,reason,status,guards(full_name,registration_selfie_path)")
    .eq("site_id", siteId)
    .in("status", ["approved", "pending"])
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date");

  type RawCal = {
    id: string; guard_id: string; type: LeaveType; start_date: string; end_date: string;
    reason: string | null; status: LeaveStatus;
    guards: { full_name: string; registration_selfie_path: string | null } | null;
  };
  const entries = (data ?? []) as unknown as RawCal[];

  return monthGrid(year, month).map((cell) => {
    const hits = entries.filter((e) => e.start_date <= cell.date && cell.date <= e.end_date);
    const toEntry = (e: RawCal): CalendarEntry => ({
      leaveId: e.id,
      guardId: e.guard_id,
      guardName: e.guards?.full_name ?? "Guard",
      avatar: e.guards?.registration_selfie_path ?? null,
      type: e.type,
      start: e.start_date,
      end: e.end_date,
      reason: e.reason,
    });
    const approved = hits.filter((e) => e.status === "approved").map(toEntry);
    const pending = hits.filter((e) => e.status === "pending").map(toEntry);
    return {
      ...cell,
      approved,
      pending,
      thinCover: new Set(approved.map((a) => a.guardId)).size >= 2,
    };
  });
}
