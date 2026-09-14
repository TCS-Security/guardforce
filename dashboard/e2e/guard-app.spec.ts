import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, agencyDate, login, SEED } from "./helpers";

/**
 * The Android guard app's contract (supabase/migrations/0011_guard_app.sql), driven exactly
 * as the app drives it: an anon client signs in with phone + OTP, claims the guard account,
 * sets a PIN, then runs a shift under its own JWT so every RLS policy is exercised for real.
 */
const METRO = { lat: 13.0281, lng: 77.5422 };
const PHONE = "+919900000012"; // Gopal Naik, SSS-012

function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signInAsGuard() {
  const app = anon();
  const { error: otpError } = await app.auth.signInWithOtp({ phone: PHONE });
  if (otpError) throw otpError;
  const { data, error } = await app.auth.verifyOtp({ phone: PHONE, token: SEED.guardOtp, type: "sms" });
  if (error) throw error;
  if (!data.session) throw new Error("no session");
  return { app, userId: data.session.user.id };
}

/** Undo everything the guard session created so the suite re-runs without a db reset. */
async function cleanup(userId: string | null, shiftIds: string[], taskIds: string[], leaveIds: string[]) {
  const db = admin();
  for (const shiftId of shiftIds) {
    const patrolIds = ((await db.from("patrols").select("id").eq("shift_id", shiftId)).data ?? []).map((p) => p.id);
    if (patrolIds.length) await db.from("patrol_photos").delete().in("patrol_id", patrolIds);
    await db.from("patrols").delete().eq("shift_id", shiftId);
    await db.from("location_pings").delete().eq("shift_id", shiftId);
    const eventIds = ((await db.from("events").select("id").eq("shift_id", shiftId)).data ?? []).map((e) => e.id);
    if (eventIds.length) await db.from("notifications").delete().in("event_id", eventIds);
    await db.from("events").delete().eq("shift_id", shiftId);
    await db.from("shifts").delete().eq("id", shiftId);
  }
  for (const taskId of taskIds) {
    await db.from("task_assignments").delete().eq("task_id", taskId);
    await db.from("tasks").delete().eq("id", taskId);
  }
  for (const leaveId of leaveIds) {
    await db.from("notifications").delete().contains("payload", { leave_id: leaveId });
    await db.from("leave_requests").delete().eq("id", leaveId);
  }
  await db.from("events").delete().eq("guard_id", SEED.guards.gopal).in("type", ["TASK_DONE", "LEAVE_REQUESTED", "TAMPER_SUSPECTED"]);
  await db.from("guard_presence").delete().eq("guard_id", SEED.guards.gopal);
  await db.from("devices").delete().eq("guard_id", SEED.guards.gopal);
  await db.from("guards").update({ profile_id: null }).eq("id", SEED.guards.gopal);
  if (userId) await db.auth.admin.deleteUser(userId);
}

test.describe("guard app contract", () => {
  test("phone OTP → claim → PIN → verified shift → patrol, task, leave → dashboard sees it all", async ({ page }) => {
    test.setTimeout(120_000);
    const db = admin();
    const shiftIds: string[] = [];
    const taskIds: string[] = [];
    const leaveIds: string[] = [];
    let userId: string | null = null;
    // A stale link from an aborted earlier run must not turn the claim into PHONE_ALREADY_LINKED.
    await db.from("guards").update({ profile_id: null }).eq("id", SEED.guards.gopal);
    await db.from("devices").delete().eq("guard_id", SEED.guards.gopal);
    await db.storage.from("selfies").remove([`${SEED.agencyId}/selfies/${SEED.guards.gopal}/e2e-start.jpg`, `${SEED.agencyId}/selfies/${SEED.guards.gopal}/e2e-end.jpg`]);

    try {
      // ---- 1. phone + OTP creates the auth user; claim links it to the guard row
      const { app, userId: uid } = await signInAsGuard();
      userId = uid;
      const claim = await app.rpc("claim_guard_account");
      expect(claim.error).toBeNull();
      const me = claim.data as { guard: { id: string; full_name: string; has_pin: boolean }; site: { id: string; patrol_photo_required: boolean }; agency: { status: string }; config: { ping_interval_moving_s: number } };
      expect(me.guard.id).toBe(SEED.guards.gopal);
      expect(me.guard.full_name).toBe("Gopal Naik");
      expect(me.site.id).toBe(SEED.sites.metro);
      expect(me.agency.status).toBe("active");
      expect(me.config.ping_interval_moving_s).toBeGreaterThan(0);

      const linked = await db.from("guards").select("profile_id, phone_verified_at").eq("id", SEED.guards.gopal).single();
      expect(linked.data?.profile_id).toBe(uid);
      expect(linked.data?.phone_verified_at).not.toBeNull();
      const profile = await db.from("profiles").select("role, agency_id").eq("id", uid).single();
      expect(profile.data).toEqual({ role: "guard", agency_id: SEED.agencyId });

      // claiming again is idempotent
      expect((await app.rpc("claim_guard_account")).error).toBeNull();

      // ---- 2. PIN: set, verify, reject
      expect((await app.rpc("set_guard_pin", { p_pin: "12ab" })).error?.message).toContain("PIN_INVALID");
      expect((await app.rpc("set_guard_pin", { p_pin: "4321" })).error).toBeNull();
      expect((await app.rpc("verify_guard_pin", { p_pin: "4321" })).data).toBe(true);
      expect((await app.rpc("verify_guard_pin", { p_pin: "1111" })).data).toBe(false);

      // ---- 3. device registration is per install and idempotent
      const dev1 = await app.rpc("register_device", { p_install_id: "e2e-install-1", p_fcm_token: "tok-e2e-1", p_model: "Redmi 9A", p_os_version: "Android 12", p_app_version: "1.0.0", p_bundle_version: "production" });
      expect(dev1.error).toBeNull();
      const dev2 = await app.rpc("register_device", { p_install_id: "e2e-install-1", p_app_version: "1.0.1" });
      expect(dev2.data).toBe(dev1.data);
      const devices = await db.from("devices").select("app_version, fcm_token").eq("guard_id", SEED.guards.gopal);
      expect(devices.data).toEqual([{ app_version: "1.0.1", fcm_token: "tok-e2e-1" }]);

      // ---- 4. RLS: the guard reads own rows only
      const ownGuards = await app.from("guards").select("id").order("id");
      expect(ownGuards.data?.map((g) => g.id)).toEqual([SEED.guards.gopal]);
      const home0 = await app.rpc("guard_home");
      expect(home0.error).toBeNull();
      // (the seed may already have this guard on a live shift; the one created below starts later and wins)
      expect(Array.isArray((home0.data as { shifts: unknown[] }).shifts)).toBe(true);

      // ---- 5. a scheduled shift for now, then the app's check-in with a selfie upload
      const start = new Date(Date.now() - 30 * 60_000);
      const end = new Date(Date.now() + 7.5 * 3_600_000);
      const shift = await db.from("shifts").insert({
        agency_id: SEED.agencyId, site_id: SEED.sites.metro, guard_id: SEED.guards.gopal, shift_date: agencyDate(),
        scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), status: "scheduled",
      }).select("id").single();
      if (shift.error) throw shift.error;
      shiftIds.push(shift.data.id);

      const selfiePath = `${SEED.agencyId}/selfies/${SEED.guards.gopal}/e2e-start.jpg`;
      const upload = await app.storage.from("selfies").upload(selfiePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg", upsert: true });
      expect(upload.error).toBeNull();
      // an outbox retry re-sends the same object with x-upsert: the uploader may overwrite their own file
      const again = await app.storage.from("selfies").upload(selfiePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg", upsert: true });
      expect(again.error).toBeNull();
      const foreign = await app.storage.from("selfies").upload(`${SEED.falconAgencyId}/selfies/x.jpg`, Buffer.from([0xff, 0xd8]), { contentType: "image/jpeg", upsert: true });
      expect(foreign.error).not.toBeNull(); // another tenant's prefix is refused

      const checkIn = await app.rpc("check_in", {
        p_guard_id: SEED.guards.gopal, p_site_id: SEED.sites.metro, p_lat: METRO.lat, p_lng: METRO.lng, p_accuracy_m: 9,
        p_selfie_path: selfiePath, p_captured_at: new Date().toISOString(),
        p_device: { battery_pct: 77, model: "Redmi 9A", app_version: "1.0.0", is_mock: false }, p_shift_id: shift.data.id,
      });
      expect(checkIn.error).toBeNull();
      expect((checkIn.data as { status: string; start_in_fence: boolean }).status).toBe("in_progress");
      expect((checkIn.data as { start_in_fence: boolean }).start_in_fence).toBe(true);

      // ---- 6. breadcrumbs, one outside the fence, then home shows the shift and its patrols
      const pings = [0, 1, 2].map((i) => ({
        recorded_at: new Date(Date.now() - (3 - i) * 60_000).toISOString(), lat: METRO.lat + (i === 1 ? 0.01 : 0.0001), lng: METRO.lng,
        accuracy_m: 12, speed_mps: 0.4, battery_pct: 76 - i, is_mock: false,
      }));
      const ingest = await app.rpc("ingest_pings", { p_shift_id: shift.data.id, p_pings: pings });
      expect(ingest.data).toBe(3);
      const home = (await app.rpc("guard_home")).data as { active_shift_id: string; shifts: { id: string; status: string }[]; patrols: { id: string; status: string; route_name: string | null }[] };
      expect(home.active_shift_id).toBe(shift.data.id);
      expect(home.shifts.find((s) => s.id === shift.data.id)?.status).toBe("in_progress");

      // ---- 7. a patrol with photo proof (Metro requires photos)
      if (home.patrols.length > 0) {
        const patrol = home.patrols[0];
        expect((await app.rpc("start_patrol", { p_patrol_id: patrol.id, p_at: new Date().toISOString() })).error).toBeNull();
        const noPhoto = await app.rpc("complete_patrol", { p_patrol_id: patrol.id, p_trail: null, p_photos: [], p_at: new Date().toISOString() });
        expect(noPhoto.error?.message).toContain("PATROL_PHOTO_REQUIRED");
        const photoPath = `${SEED.agencyId}/patrols/${patrol.id}/e2e.jpg`;
        await app.storage.from("patrol-photos").upload(photoPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg", upsert: true });
        const done = await app.rpc("complete_patrol", {
          p_patrol_id: patrol.id,
          p_trail: { type: "LineString", coordinates: [[METRO.lng, METRO.lat], [METRO.lng + 0.001, METRO.lat + 0.001]] },
          p_photos: [{ file_path: photoPath, lat: METRO.lat, lng: METRO.lng, taken_at: new Date().toISOString() }],
          p_at: new Date().toISOString(),
        });
        expect(done.error).toBeNull();
        expect(["completed", "late"]).toContain((done.data as { status: string }).status);
      }

      // ---- 8. a task assigned by the dashboard, completed from the app with a photo
      const task = await db.from("tasks").insert({ agency_id: SEED.agencyId, site_id: SEED.sites.metro, title: `E2E gate check ${Date.now()}`, photo_required: true, created_by: "b0000000-0000-4000-8000-000000000001" }).select("id").single();
      if (task.error) throw task.error;
      taskIds.push(task.data.id);
      await db.from("task_assignments").insert({ task_id: task.data.id, guard_id: SEED.guards.gopal, agency_id: SEED.agencyId });
      const homeWithTask = (await app.rpc("guard_home")).data as { tasks: { id: string; status: string }[] };
      expect(homeWithTask.tasks.map((t) => t.id)).toContain(task.data.id);
      expect((await app.rpc("start_task", { p_task_id: task.data.id })).error).toBeNull();
      expect((await app.rpc("complete_task", { p_task_id: task.data.id })).error?.message).toContain("TASK_PHOTO_REQUIRED");
      const taskDone = await app.rpc("complete_task", { p_task_id: task.data.id, p_photo_path: `${SEED.agencyId}/tasks/${task.data.id}/e2e.jpg`, p_note: "All clear", p_lat: METRO.lat, p_lng: METRO.lng });
      expect(taskDone.error).toBeNull();
      expect((await db.from("tasks").select("status").eq("id", task.data.id).single()).data?.status).toBe("done");
      // retrying the same completion (offline outbox replay) is a no-op
      expect((await app.rpc("complete_task", { p_task_id: task.data.id, p_photo_path: "x" })).error).toBeNull();

      // ---- 9. leave: apply, overlap rejected, cancel
      const from = agencyDate(20);
      const leave = await app.rpc("apply_leave", { p_type: "casual", p_start: from, p_end: from, p_reason: "Family function" });
      expect(leave.error).toBeNull();
      leaveIds.push((leave.data as { id: string }).id);
      expect((await app.rpc("apply_leave", { p_type: "earned", p_start: from, p_end: agencyDate(21) })).error?.message).toContain("LEAVE_OVERLAP");
      const supervisorInbox = await db.from("notifications").select("id").eq("recipient_profile_id", "b0000000-0000-4000-8000-000000000003").contains("payload", { leave_id: (leave.data as { id: string }).id });
      expect(supervisorInbox.data?.length).toBe(1);

      // ---- 10. the dashboard shows the guard on duty and the shift in attendance
      await login(page, SEED.supervisor2);
      await page.goto(`/attendance?date=${agencyDate()}&site=${SEED.sites.metro}`);
      const row = page.getByRole("table", { name: "Attendance" }).getByRole("row").filter({ hasText: "Gopal Naik" });
      await expect(row.first()).toBeVisible();
      // the "On duty now" panel lists guards with a running shift; the table row itself still reads Pending
      await expect(page.locator("ul > li").filter({ hasText: "Gopal Naik" }).filter({ hasText: /in \d\d:\d\d/ }).first()).toBeVisible();

      // ---- 11. check out, attendance computed, guard sees it in history
      const outSelfie = `${SEED.agencyId}/selfies/${SEED.guards.gopal}/e2e-end.jpg`;
      const checkOut = await app.rpc("check_out", { p_shift_id: shift.data.id, p_lat: METRO.lat, p_lng: METRO.lng, p_accuracy_m: 11, p_selfie_path: outSelfie, p_captured_at: new Date().toISOString(), p_device: { battery_pct: 60 } });
      expect(checkOut.error).toBeNull();
      expect((checkOut.data as { status: string }).status).toBe("completed");
      const history = await app.from("shifts").select("id,status,attendance,sites(name)").eq("guard_id", SEED.guards.gopal).eq("id", shift.data.id).single();
      expect(history.data?.status).toBe("completed");
      expect((history.data?.sites as unknown as { name: string })?.name).toContain("Metro");

      expect((await app.rpc("cancel_leave", { p_leave_id: (leave.data as { id: string }).id })).error).toBeNull();
    } finally {
      await cleanup(userId, shiftIds, taskIds, leaveIds);
    }
  });

  test("a phone nobody registered cannot claim an account", async () => {
    const db = admin();
    const app = anon();
    // 9876543210 is only in the test OTP map, not in any agency's guard list.
    const { error: otpError } = await app.auth.signInWithOtp({ phone: "+919876543210" });
    expect(otpError).toBeNull();
    const { data, error } = await app.auth.verifyOtp({ phone: "+919876543210", token: "123456", type: "sms" });
    expect(error).toBeNull();
    try {
      const claim = await app.rpc("claim_guard_account");
      expect(claim.error?.message).toContain("NO_GUARD_FOR_PHONE");
      expect((await app.rpc("guard_home")).error?.message).toContain("NO_GUARD_FOR_PHONE");
    } finally {
      if (data.session) await db.auth.admin.deleteUser(data.session.user.id);
    }
  });
});
