import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Battery from "expo-battery";
import { create } from "zustand";
import { guardApi } from "../api/guardApi";
import { env, supabase } from "../api/supabase";
import { toApiError } from "../api/errors";
import type { Home, Me, ShiftInfo } from "../api/types";
import { prefs } from "../auth/prefs";
import { dutyState, type DutyState, type LocalShift } from "../domain/duty";
import type { Fence } from "../domain/geo";
import { makeTime } from "../domain/time";
import { GuardTracking, type TrackingStatus } from "../../modules/guard-tracking";
import { t } from "../i18n";
import { cache, localShifts, outbox, overrides, pings, wipeAll, type OverrideRow } from "./db";
import { Kinds, type CheckInPayload, type CheckOutPayload, type LocalPhoto } from "./payloads";
import { sync } from "./sync";

export type AuthStage = "loading" | "signed_out" | "needs_claim" | "needs_pin" | "locked" | "ready";

type State = {
  stage: AuthStage;
  pendingPhone: string | null;
  me: Me | null;
  home: Home | null;
  duty: DutyState | null;
  online: boolean;
  pending: number;
  tracking: TrackingStatus;
  patrolOverrides: OverrideRow[];
  taskOverrides: OverrideRow[];
  issues: string[];
};

const toLocal = (r: ReturnType<typeof localShifts.current>): LocalShift | null =>
  r ? { key: r.key, serverId: r.server_id, siteId: r.site_id, startedAtMs: r.started_at, status: r.status as LocalShift["status"] } : null;

export const useStore = create<State>(() => ({
  stage: "loading", pendingPhone: null, me: cache.get<Me>("me"), home: cache.get<Home>("home"), duty: null, online: true,
  pending: 0, tracking: {}, patrolOverrides: [], taskOverrides: [], issues: [],
}));

const set = useStore.setState;
const get = useStore.getState;

// --- derived ----------------------------------------------------------------------------------
export const zone = () => get().me?.agency.timezone ?? "Asia/Kolkata";
export const time = () => makeTime(zone());
export function fence(): Fence | null {
  const s = get().me?.site;
  if (!s) return null;
  const ring = s.polygon?.coordinates?.[0] as [number, number][] | undefined;
  return { type: s.fence_type, lat: s.lat, lng: s.lng, radiusM: s.radius_m, leewayM: s.leeway_m, polygon: ring };
}
export const feature = (key: string, def = true) => { const v = get().me?.config?.features?.[key]; return typeof v === "boolean" ? v : def; };

export function recompute() {
  const h = get().home;
  set({
    duty: dutyState(h?.shifts ?? [], h?.active_shift_id, toLocal(localShifts.current()), get().me?.guard.site_id, Date.now()),
    pending: outbox.count() + pings.count() + safePendingNative(),
    patrolOverrides: overrides.list("patrol"), taskOverrides: overrides.list("task"),
  });
}
const safePendingNative = () => { try { return GuardTracking.getPendingCount(); } catch { return 0; } };

// --- auth -------------------------------------------------------------------------------------
export async function bootstrap() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) { set({ stage: "signed_out" }); return; }
  const guardId = await prefs.guardId();
  set({ stage: guardId ? "locked" : "needs_claim" });
  try { GuardTracking.onStatus((s) => set({ tracking: { ...get().tracking, ...s } })); set({ tracking: GuardTracking.getStatus() }); } catch { /* module absent in tests */ }
  recompute();
}

export async function requestOtp(phoneE164: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164, options: { shouldCreateUser: true } });
  if (error) throw toApiError(error);
  set({ pendingPhone: phoneE164 });
}
export async function verifyOtp(code: string) {
  const phone = get().pendingPhone; if (!phone) throw new Error("no phone");
  const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw toApiError(error);
  await prefs.setPhone(phone);
  set({ stage: "needs_claim" });
}
export async function claim() {
  const me = await guardApi.claimAccount();
  await prefs.setGuardId(me.guard.id); await prefs.setAgencyId(me.guard.agency_id); await prefs.setGuardName(me.guard.full_name);
  cache.put("me", me); set({ me });
  set({ stage: me.guard.has_pin ? "locked" : "needs_pin" });
  return me;
}
export async function setPin(pin: string) { await guardApi.setPin(pin); await prefs.saveLocalPin(pin); set({ stage: "ready" }); }
export async function unlock(pin: string): Promise<boolean> {
  if (await prefs.checkLocalPin(pin)) { set({ stage: "ready" }); return true; }
  try { if (await guardApi.verifyPin(pin)) { await prefs.saveLocalPin(pin); set({ stage: "ready" }); return true; } } catch { /* offline */ }
  return false;
}
export const unlockWithDevice = async () => { if (await prefs.hasLocalPin()) set({ stage: "ready" }); };
export const lock = () => { if (get().stage === "ready") set({ stage: "locked" }); };
export async function signOut() {
  await GuardTracking.clearAll().catch(() => undefined);
  await supabase.auth.signOut().catch(() => undefined);
  await prefs.clear(); wipeAll();
  set({ stage: "signed_out", me: null, home: null, duty: null, pendingPhone: null, pending: 0 });
}

// --- reads ------------------------------------------------------------------------------------
export async function refreshMe() {
  try { const me = await guardApi.me(); cache.put("me", me); set({ me, online: true }); await prefs.setGuardId(me.guard.id); await prefs.setAgencyId(me.guard.agency_id); await prefs.setGuardName(me.guard.full_name); return me; }
  catch (e) { if (toApiError(e).retryable) set({ online: false }); else throw e; return get().me; }
}
export async function refreshHome() {
  try { const h = await guardApi.home(); cache.put("home", h); set({ home: h, online: true }); reconcile(h); recompute(); return h; }
  catch (e) { if (toApiError(e).retryable) set({ online: false }); return get().home; }
}
export async function refreshAll() { await refreshMe().catch(() => null); await refreshHome(); recompute(); }

/** The server is the truth about which shift is running; align the phone with it. */
function reconcile(h: Home) {
  const local = localShifts.current();
  const guardId = get().me?.guard.id ?? "";
  if (!local) {
    const active = h.active_shift_id ? h.shifts.find((s) => s.id === h.active_shift_id) : undefined;
    if (active) { // e.g. reinstalled mid-shift: adopt the running shift so tracking resumes
      const since = Date.parse(active.start_captured_at ?? active.started_at ?? "") || Date.now();
      localShifts.upsert({ key: `srv-${active.id}`, server_id: active.id, site_id: active.site_id, guard_id: guardId, started_at: since, status: "active" });
      void startTracking(`srv-${active.id}`);
    }
    return;
  }
  if (local.server_id && local.status === "active" && h.active_shift_id !== local.server_id) {
    const srv = h.shifts.find((s) => s.id === local.server_id);
    if (srv && srv.status !== "in_progress") { localShifts.setStatus(local.key, "closed"); void GuardTracking.stop().catch(() => undefined); }
  }
}

// --- writes -----------------------------------------------------------------------------------
async function enqueue(kind: string, payload: unknown) {
  outbox.insert(kind, payload); recompute();
  void syncNow();
}
export async function syncNow() { const ok = await sync(); if (ok) await refreshHome(); recompute(); return ok; }

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
const agency = () => get().me?.guard.agency_id ?? "unknown";
const guard = () => get().me?.guard.id ?? "unknown";

export async function deviceJson(isMock: boolean) {
  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  return { battery_pct: level >= 0 ? Math.round(level * 100) : null, model: `${Device.manufacturer ?? ""} ${Device.modelName ?? ""}`.trim(), os: `${Platform.OS} ${Device.osVersion ?? ""}`, app_version: env.appVersion, is_mock: isMock };
}

async function startTracking(shiftKey: string) {
  const me = get().me;
  await GuardTracking.start({
    shiftKey, siteName: me?.site?.name ?? "", fence: fence(),
    movingS: me?.config?.ping_interval_moving_s ?? 120, stationaryS: me?.config?.ping_interval_stationary_s ?? 900,
    warnMin: me?.agency.location_off_warn_min ?? 30,
    texts: { trackingTitle: t("notif_tracking_title", me?.site?.name ?? ""), trackingBody: t("notif_tracking_body"), trackingOffTitle: t("notif_tracking_off"), locationOffTitle: t("notif_location_off_title"), locationOffBody: t("notif_location_off_body") },
  });
}

export async function checkIn(p: { selfieUri: string; lat: number; lng: number; accuracyM: number | null; isMock: boolean; shift: ShiftInfo | null }) {
  const siteId = p.shift?.site_id ?? get().me?.guard.site_id;
  if (!siteId) throw new Error("no site");
  const key = `loc-${Math.random().toString(36).slice(2, 10)}`;
  const remote = `${agency()}/selfies/${guard()}/${stamp()}-start.jpg`;
  localShifts.upsert({ key, server_id: null, site_id: siteId, guard_id: guard(), started_at: Date.now(), status: "pending_check_in" });
  const payload: CheckInPayload = { shiftKey: key, guardId: guard(), siteId, lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, selfieFile: p.selfieUri, selfieRemotePath: remote, capturedAt: new Date().toISOString(), device: await deviceJson(p.isMock), shiftId: p.shift?.id ?? null };
  await startTracking(key);
  await enqueue(Kinds.CHECK_IN, payload);
  return key;
}

export async function checkOut(p: { selfieUri: string; lat: number; lng: number; accuracyM: number | null; isMock: boolean }) {
  const local = localShifts.current(); if (!local) return;
  const remote = `${agency()}/selfies/${guard()}/${stamp()}-end.jpg`;
  await GuardTracking.stop().catch(() => undefined);
  localShifts.setStatus(local.key, "pending_check_out");
  const payload: CheckOutPayload = { shiftKey: local.key, lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, selfieFile: p.selfieUri, selfieRemotePath: remote, capturedAt: new Date().toISOString(), device: await deviceJson(p.isMock) };
  await enqueue(Kinds.CHECK_OUT, payload);
}

export const patrolPhotoPath = (patrolId: string) => `${agency()}/patrols/${patrolId}/${stamp()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
export const taskPhotoPath = (taskId: string) => `${agency()}/tasks/${taskId}/${guard()}-${stamp()}.jpg`;

export async function startPatrol(patrolId: string) {
  overrides.put("patrol", patrolId, "in_progress");
  await GuardTracking.setPatrol(patrolId).catch(() => undefined);
  await enqueue(Kinds.PATROL_START, { patrolId, at: new Date().toISOString() });
}
export async function completePatrol(patrolId: string, photos: LocalPhoto[], notes: string) {
  const trail = (await GuardTracking.trail(patrolId).catch(() => [])).map((p) => [p.lng, p.lat] as [number, number]);
  await GuardTracking.setPatrol(null).catch(() => undefined);
  overrides.put("patrol", patrolId, "completed");
  await enqueue(Kinds.PATROL_COMPLETE, { patrolId, trail, photos, at: new Date().toISOString(), notes: notes.trim() || null });
  await GuardTracking.clearTrail(patrolId).catch(() => undefined);
}
export async function startTask(taskId: string) { overrides.put("task", taskId, "in_progress"); await enqueue(Kinds.TASK_START, { taskId, at: new Date().toISOString() }); }
export async function completeTask(taskId: string, photo: LocalPhoto | null, note: string, lat: number | null, lng: number | null) {
  overrides.put("task", taskId, "done");
  await enqueue(Kinds.TASK_COMPLETE, { taskId, photo, note: note.trim() || null, lat, lng, at: new Date().toISOString() });
}
/** Leave goes straight to the server when online so the guard sees the real outcome. */
export async function applyLeave(type: string, start: string, end: string, reason: string | null): Promise<boolean> {
  try { await guardApi.applyLeave(type, start, end, reason); return true; }
  catch (e) { const err = toApiError(e); if (!err.retryable) throw err; await enqueue(Kinds.LEAVE_APPLY, { type, start, end, reason }); return false; }
}
export async function cancelLeave(id: string) {
  try { await guardApi.cancelLeave(id); } catch (e) { if (!toApiError(e).retryable) throw e; await enqueue(Kinds.LEAVE_CANCEL, { id }); }
}
export async function setRegistrationSelfie(fileUri: string) {
  const remote = `${agency()}/selfies/reg/${guard()}.jpg`;
  const me = get().me; if (me) set({ me: { ...me, guard: { ...me.guard, registration_selfie_path: remote } } });
  await enqueue(Kinds.REG_SELFIE, { file: fileUri, remotePath: remote });
}
export async function registerDevice(fcmToken: string | null) {
  try {
    await guardApi.registerDevice({ installId: await prefs.installId(), fcmToken, model: `${Device.manufacturer ?? ""} ${Device.modelName ?? ""}`.trim(), osVersion: `Android ${Device.osVersion ?? ""}`, appVersion: env.appVersion, bundleVersion: env.otaChannel });
  } catch { /* not fatal */ }
}
export const pushIssue = (code: string) => set({ issues: [...get().issues, code] });
export const popIssue = () => set({ issues: get().issues.slice(1) });
