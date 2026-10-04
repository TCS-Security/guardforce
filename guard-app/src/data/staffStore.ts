import { create } from "zustand";
import { toApiError } from "../api/errors";
import { staffApi } from "../api/staffApi";
import type { StaffMe, SupervisorHome } from "../api/staffTypes";
import { makeTime } from "../domain/time";
import { cache } from "./db";

/** Supervisor-mode state. Guard mode lives in store.ts; the two never run at the same time. */
type StaffState = { me: StaffMe | null; home: SupervisorHome | null; online: boolean; refreshing: boolean };
export const useStaff = create<StaffState>(() => ({ me: cache.get<StaffMe>("staff_me"), home: cache.get<SupervisorHome>("staff_home"), online: true, refreshing: false }));

export const staffZone = () => useStaff.getState().me?.agency.timezone ?? "Asia/Kolkata";
export const staffTime = () => makeTime(staffZone());
export const can = (key: string) => { const m = useStaff.getState().me; return !!m && (m.profile.role === "owner" || m.permissions.includes(key)); };
export const useCan = (key: string) => useStaff((s) => !!s.me && (s.me.profile.role === "owner" || s.me.permissions.includes(key)));

export async function refreshStaffMe() {
  try { const me = await staffApi.me(); cache.put("staff_me", me); useStaff.setState({ me, online: true }); return me; }
  catch (e) { if (toApiError(e).retryable) { useStaff.setState({ online: false }); return useStaff.getState().me; } throw e; }
}
export async function refreshStaffHome(date?: string) {
  useStaff.setState({ refreshing: true });
  try { const home = await staffApi.home(date); cache.put("staff_home", home); useStaff.setState({ home, online: true }); return home; }
  catch (e) { if (toApiError(e).retryable) { useStaff.setState({ online: false }); return useStaff.getState().home; } throw e; }
  finally { useStaff.setState({ refreshing: false }); }
}
export async function refreshStaffAll() { await refreshStaffMe().catch(() => null); await refreshStaffHome().catch(() => null); }
export function clearStaff() { useStaff.setState({ me: null, home: null }); }
