import "server-only";
import { headers } from "next/headers";
import { subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Session } from "@/lib/auth/session";
import { toLocalDate } from "@/lib/domain/format";
import { nextEmployeeCode } from "@/lib/domain/guards";
import { kycGaps } from "@/lib/domain/kyc";
import type { Guard, GuardDocument, LeaveBalance, ProfileShare } from "@/lib/supabase/types";

export type GuardRow = Guard & {
  sites: { id: string; name: string } | null;
  profiles: { id: string; full_name: string } | null;
  guard_documents: Pick<GuardDocument, "type" | "status" | "file_path">[];
  last_shift: { shift_date: string; attendance: string; status: string; started_at: string | null } | null;
};

export type GuardListFilters = {
  site?: string;
  status?: string;
  kyc?: string;
  q?: string;
  sort?: string;
};

const GUARD_SELECT =
  "*, sites(id,name), profiles!guards_supervisor_id_fkey(id,full_name), guard_documents(type,status,file_path)";

/** Roster list: every guard in scope with their KYC slots, site, supervisor and last shift. */
export async function listGuards(session: Session, filters: GuardListFilters = {}): Promise<GuardRow[]> {
  const supabase = await createClient();
  let query = supabase.from("guards").select(GUARD_SELECT);
  if (filters.site) query = query.eq("site_id", filters.site);
  if (filters.status) query = query.eq("status", filters.status as Guard["status"]);
  if (filters.q?.trim()) {
    const q = filters.q.trim().replace(/[%,]/g, "");
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,employee_code.ilike.%${q}%`);
  }
  const { data: guards, error } = await query.order("employee_code");
  if (error) throw new Error(`listGuards: ${error.message}`);

  const ids = (guards ?? []).map((g) => g.id);
  const since = toLocalDate(subDays(new Date(), 60), session.agency.timezone);
  const { data: shifts } = ids.length
    ? await supabase
        .from("shifts")
        .select("guard_id,shift_date,attendance,status,started_at")
        .in("guard_id", ids)
        .gte("shift_date", since)
        .lte("shift_date", toLocalDate(new Date(), session.agency.timezone))
        .order("shift_date", { ascending: false })
    : { data: [] };

  // Prefer the most recent shift the guard actually worked; today's not-yet-started
  // shift is only used when there is nothing worked in the window.
  const last = new Map<string, { shift_date: string; attendance: string; status: string; started_at: string | null }>();
  for (const s of shifts ?? []) {
    const seen = last.get(s.guard_id);
    if (!seen || (!seen.started_at && s.started_at)) last.set(s.guard_id, s);
  }

  let rows = (guards ?? []).map((g) => ({ ...g, last_shift: last.get(g.id) ?? null })) as GuardRow[];

  if (filters.kyc === "incomplete") rows = rows.filter((g) => kycGaps(g, g.guard_documents).length > 0);
  if (filters.kyc === "complete") rows = rows.filter((g) => kycGaps(g, g.guard_documents).length === 0);

  return rows;
}

/** Sites and supervisors the signed-in user may assign a guard to. */
export async function loadGuardFormOptions() {
  const supabase = await createClient();
  const [{ data: sites }, { data: supervisors }, { data: codes }] = await Promise.all([
    supabase.from("sites").select("id,name").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id,full_name,role").in("role", ["supervisor", "admin", "owner"]).eq("is_active", true).order("full_name"),
    supabase.from("guards").select("employee_code"),
  ]);
  return {
    sites: sites ?? [],
    supervisors: supervisors ?? [],
    suggestedCode: nextEmployeeCode((codes ?? []).map((c) => c.employee_code), "SSS-"),
  };
}

export type GuardDetail = {
  guard: Guard & { sites: { id: string; name: string } | null; profiles: { id: string; full_name: string } | null };
  documents: GuardDocument[];
  uploaders: Map<string, string>;
  shares: ProfileShare[];
  invite: { id: string; token: string; sent_at: string | null; channel: string; expires_at: string } | null;
  scorecard: Scorecard;
  shifts: RecentShift[];
  leave: LeaveBalance | null;
  accessLogs: AccessLogRow[];
  selfieUrl: string | null;
};

export type Scorecard = {
  shifts: number; present: number; half_day: number; absent: number; on_leave: number;
  punctuality_pct: number | null; avg_away_min: number; flagged: number; void: number;
  missed_patrols: number; patrols: number; worked_hours: number;
};

export type RecentShift = {
  id: string; shift_date: string; started_at: string | null; ended_at: string | null;
  attendance: string; status: string; trust: string | null; flags: string[];
  sites: { name: string } | null;
};

export type AccessLogRow = {
  id: number; created_at: string; purpose: string | null; document_id: string;
  accessed_by: string | null; share_id: string | null;
};

/** Everything the guard profile page renders. Returns null when RLS hides the guard. */
export async function loadGuard(session: Session, guardId: string): Promise<GuardDetail | null> {
  const supabase = await createClient();
  const { data: guard } = await supabase
    .from("guards")
    .select("*, sites(id,name), profiles!guards_supervisor_id_fkey(id,full_name)")
    .eq("id", guardId)
    .maybeSingle();
  if (!guard) return null;

  const from = toLocalDate(subDays(new Date(), 29), session.agency.timezone);
  const to = toLocalDate(new Date(), session.agency.timezone);

  const [docs, shares, invites, score, shifts, leave, profiles] = await Promise.all([
    supabase.from("guard_documents").select("*").eq("guard_id", guardId).order("type"),
    supabase.from("profile_shares").select("*").eq("guard_id", guardId).order("created_at", { ascending: false }),
    supabase.from("guard_invites").select("id,token,sent_at,channel,expires_at").eq("guard_id", guardId).order("created_at", { ascending: false }).limit(1),
    supabase.rpc("guard_scorecard", { p_guard_id: guardId, p_from: from, p_to: to }),
    supabase
      .from("shifts")
      .select("id,shift_date,started_at,ended_at,attendance,status,trust,flags,sites(name)")
      .eq("guard_id", guardId)
      .lte("shift_date", to)
      .order("shift_date", { ascending: false })
      .limit(12),
    supabase.from("leave_balances").select("*").eq("guard_id", guardId).eq("year", new Date().getFullYear()).maybeSingle(),
    supabase.from("profiles").select("id,full_name"),
  ]);

  const documents = (docs.data ?? []) as GuardDocument[];
  let accessLogs: AccessLogRow[] = [];
  if (session.isOwner && documents.length) {
    const { data } = await supabase
      .from("document_access_logs")
      .select("id,created_at,purpose,document_id,accessed_by,share_id")
      .in("document_id", documents.map((d) => d.id))
      .order("created_at", { ascending: false })
      .limit(40);
    accessLogs = (data ?? []) as AccessLogRow[];
  }

  return {
    guard: guard as GuardDetail["guard"],
    documents,
    uploaders: new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])),
    shares: (shares.data ?? []) as ProfileShare[],
    invite: invites.data?.[0] ?? null,
    scorecard: (score.data ?? {}) as Scorecard,
    shifts: (shifts.data ?? []) as unknown as RecentShift[],
    leave: (leave.data ?? null) as LeaveBalance | null,
    accessLogs,
    selfieUrl: await signedUrl("selfies", guard.registration_selfie_path),
  };
}

/**
 * Signed URL for a private storage object. Uses the service-role client because the
 * dashboard renders these inside pages that have already been authorised by RLS.
 * Returns null when the object is missing (the demo seed references paths that were
 * never uploaded).
 */
export async function signedUrl(bucket: string, path: string | null | undefined, expiresIn = 600) {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Absolute origin of the current request — used to build invite/share links that work from any worktree port. */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
