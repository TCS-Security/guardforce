import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { admin, agencyDate, SEED } from "./helpers";

/**
 * Supervisor mode's contract (supabase/migrations/0012_supervisor_app.sql), driven exactly as
 * the Android app drives it: an anon supabase-js client signs in with email + password and
 * every read and write goes through an RPC under that user's own JWT, so the site scoping and
 * the permission checks are exercised for real rather than mocked.
 *
 * Arun supervises Metro Cash & Carry only; Priya supervises Prestige and Brigade. Nothing in
 * either session may ever see the other's site.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signIn(email: string, password = "guardforce") {
  const app = anon();
  const { error } = await app.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return app;
}

type StaffMe = {
  profile: { id: string; full_name: string; role: string; role_name: string | null; all_sites: boolean };
  agency: { id: string; status: string; timezone: string; late_threshold_min: number };
  permissions: string[];
  sites: { id: string; name: string; guards_required: number; patrol_photo_required: boolean }[];
  server_time: string;
};
type SupervisorHome = {
  date: string;
  sites: { id: string; name: string; late: number; scheduled: number; on_duty_now: number }[];
  on_duty: { guard_id: string; site_id: string; shift_id: string | null; flags: string[] }[];
  alerts: { id: string; severity: string; site_id: string | null; site_name: string | null; shift_date: string | null }[];
  pending_leave: number;
  missed_patrols_today: number;
};

async function rpc<T>(app: SupabaseClient, name: string, params: Record<string, unknown> = {}) {
  const { data, error } = await app.rpc(name, params);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

test.describe("supervisor app contract", () => {
  test("Arun runs Metro from the phone: onboarding, KYC, roster, tasks, leave, alerts, corrections", async () => {
    test.setTimeout(150_000);
    const db = admin();
    const app = await signIn(SEED.supervisor2.email);
    // The seeded Supervisor role deliberately excludes guards:kyc, so the KYC slots are filled
    // by an owner session; the supervisor's denial is asserted below.
    const ownerApp = await signIn(SEED.owner.email);

    const phone = "98" + String(Date.now()).slice(-8);
    const kycPaths: string[] = [];
    let guardId: string | null = null;
    let assignmentId: string | null = null;
    let taskId: string | null = null;
    let leaveId: string | null = null;
    let eventId: string | null = null;
    let shiftId: string | null = null;

    try {
      // ---- 1. staff_me: identity, permissions and exactly one site
      const me = await rpc<StaffMe>(app, "staff_me");
      expect(me.profile.full_name).toBe(SEED.supervisor2.name);
      expect(me.profile.role).toBe("staff");
      expect(me.profile.role_name).toBe("Supervisor");
      expect(me.profile.all_sites).toBe(false);
      expect(me.agency.id).toBe(SEED.agencyId);
      expect(me.agency.status).toBe("active");
      expect(me.agency.timezone).toBe("Asia/Kolkata");
      expect(me.agency.late_threshold_min).toBeGreaterThan(0);
      expect(me.sites.map((s) => s.id)).toEqual([SEED.sites.metro]);
      expect(me.permissions).toEqual(expect.arrayContaining(["roster:write", "tasks:write", "guards:write", "leave:decide"]));
      expect(me.permissions).not.toContain("guards:kyc");
      expect(typeof me.server_time).toBe("string");

      // ---- 2. supervisor_home never reaches outside the scope
      const home = await rpc<SupervisorHome>(app, "supervisor_home");
      expect(home.date).toBe(agencyDate());
      expect(home.sites.map((s) => s.id)).toEqual([SEED.sites.metro]);
      expect(home.sites[0]).toHaveProperty("late");
      expect(Array.isArray(home.on_duty)).toBe(true);
      expect(home.on_duty.every((g) => g.site_id === SEED.sites.metro)).toBe(true);
      expect(Array.isArray(home.alerts)).toBe(true);
      expect(home.alerts.every((a) => a.site_id === null || a.site_id === SEED.sites.metro)).toBe(true);
      expect(home.alerts.every((a) => a.severity !== "info")).toBe(true);
      expect(typeof home.pending_leave).toBe("number");
      expect(typeof home.missed_patrols_today).toBe("number");

      // ---- 3. a site outside the scope is refused, not filtered
      const outside = await app.rpc("site_shifts", { p_site_id: SEED.sites.prestige, p_date: agencyDate() });
      expect(outside.error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("roster_day", { p_date: agencyDate(), p_site_id: SEED.sites.prestige })).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("guard_record", { p_guard_id: SEED.guards.ramesh })).error?.message).toContain("FORBIDDEN");
      // ...and the site in scope is readable
      const metroShifts = await rpc<{ id: string; guard_name: string }[]>(app, "site_shifts", { p_site_id: SEED.sites.metro, p_date: agencyDate() });
      expect(Array.isArray(metroShifts)).toBe(true);

      // ---- 4. add_guard: a new hire onboarded from the field
      guardId = await rpc<string>(app, "add_guard", { p_full_name: "E2E Field Hire", p_phone: phone, p_designation: "Gate Guard", p_site_id: SEED.sites.metro });
      const created = await db.from("guards").select("phone,status,site_id,supervisor_id,invited_at").eq("id", guardId).single();
      expect(created.data).toMatchObject({ phone, status: "invited", site_id: SEED.sites.metro, supervisor_id: me.profile.id });
      expect(created.data?.invited_at).not.toBeNull();
      expect((await db.from("guard_invites").select("channel").eq("guard_id", guardId)).data).toEqual([{ channel: "whatsapp" }]);

      // the phone is the identity: a second guard on it is refused
      expect((await app.rpc("add_guard", { p_full_name: "Duplicate", p_phone: `+91${phone}`, p_site_id: SEED.sites.metro })).error?.message).toContain("GUARD_PHONE_EXISTS");
      // a site outside the scope is refused too
      expect((await app.rpc("add_guard", { p_full_name: "Elsewhere", p_phone: "9" + String(Date.now() + 1).slice(-9), p_site_id: SEED.sites.prestige })).error?.message).toContain("FORBIDDEN");

      // ---- 5. KYC is incomplete, so the roster refuses the new guard
      const shiftTypes = await app.from("shift_types").select("id,name,start_time").eq("site_id", SEED.sites.metro).order("start_time");
      expect(shiftTypes.error).toBeNull();
      const dayShift = shiftTypes.data!.find((s) => s.name === "Day")!;
      const rosterDate = agencyDate(5);
      const tooEarly = await app.rpc("assign_shift", { p_guard_id: guardId, p_site_id: SEED.sites.metro, p_shift_type_id: dayShift.id, p_date: rosterDate });
      expect(tooEarly.error?.message).toContain("KYC_INCOMPLETE");

      let record = await rpc<{ kyc_missing: string[]; guard: { site_name: string }; documents: unknown[]; supervisor: { name: string } }>(app, "guard_record", { p_guard_id: guardId });
      expect(record.guard.site_name).toContain("Metro");
      expect(record.supervisor.name).toBe(SEED.supervisor2.name);
      expect(record.kyc_missing).toEqual(expect.arrayContaining(["phone_verification", "registration_selfie", "aadhaar", "pan", "police_verification", "guard_kyc"]));
      expect(record.kyc_missing).not.toContain("designation");

      // ---- 6. KYC capture: upload, then record the slot (guards:kyc; the Supervisor role has none)
      expect((await app.rpc("record_document", { p_guard_id: guardId, p_type: "aadhaar", p_file_path: `${SEED.agencyId}/kyc/${guardId}/aadhaar.jpg` })).error?.message).toContain("FORBIDDEN");

      const docIds: string[] = [];
      for (const type of ["aadhaar", "pan", "police_verification", "guard_kyc"] as const) {
        const path = `${SEED.agencyId}/kyc/${guardId}/${type}.jpg`;
        kycPaths.push(path);
        const up = await ownerApp.storage.from("kyc-docs").upload(path, JPEG, { contentType: "image/jpeg", upsert: true });
        expect(up.error).toBeNull();
        docIds.push(await rpc<string>(ownerApp, "record_document", { p_guard_id: guardId, p_type: type, p_file_path: path, p_mime_type: "image/jpeg", p_number_masked: type === "aadhaar" ? "XXXX XXXX 9021" : null }));
      }
      // another tenant's prefix is refused outright
      expect((await ownerApp.rpc("record_document", { p_guard_id: guardId, p_type: "other", p_file_path: `${SEED.falconAgencyId}/kyc/x.jpg` })).error?.message).toContain("BAD_PATH");

      // re-recording a mandatory slot replaces it rather than piling up rows
      const again = await rpc<string>(ownerApp, "record_document", { p_guard_id: guardId, p_type: "aadhaar", p_file_path: `${SEED.agencyId}/kyc/${guardId}/aadhaar.jpg` });
      expect(again).toBe(docIds[0]);
      expect((await db.from("guard_documents").select("id").eq("guard_id", guardId)).data?.length).toBe(4);

      // opening a document is audited
      await rpc<void>(ownerApp, "log_document_access", { p_document_id: docIds[0], p_purpose: "e2e review" });
      expect((await db.from("document_access_logs").select("purpose").eq("document_id", docIds[0])).data).toEqual([{ purpose: "e2e review" }]);

      // ---- 7. registration selfie (guards:write, so the supervisor does this one)
      const selfiePath = `${SEED.agencyId}/selfies/reg/${guardId}.jpg`;
      expect((await app.rpc("set_guard_registration_selfie", { p_guard_id: guardId, p_path: `${SEED.falconAgencyId}/selfies/x.jpg` })).error?.message).toContain("BAD_PATH");
      await app.storage.from("selfies").upload(selfiePath, JPEG, { contentType: "image/jpeg", upsert: true });
      await rpc<void>(app, "set_guard_registration_selfie", { p_guard_id: guardId, p_path: selfiePath });
      expect((await db.from("guards").select("registration_selfie_path").eq("id", guardId).single()).data?.registration_selfie_path).toBe(selfiePath);

      record = await rpc(app, "guard_record", { p_guard_id: guardId });
      expect(record.kyc_missing).toEqual(["phone_verification"]); // only the OTP the guard does themselves
      expect(record.documents.length).toBe(4);

      // the guard has not run the app yet, so the OTP timestamp is arranged here
      await db.from("guards").update({ phone_verified_at: new Date().toISOString() }).eq("id", guardId);
      record = await rpc(app, "guard_record", { p_guard_id: guardId });
      expect(record.kyc_missing).toEqual([]);

      // ---- 8. assign_shift now succeeds, and an offline retry returns the same row
      assignmentId = await rpc<string>(app, "assign_shift", { p_guard_id: guardId, p_site_id: SEED.sites.metro, p_shift_type_id: dayShift.id, p_date: rosterDate });
      expect(await rpc<string>(app, "assign_shift", { p_guard_id: guardId, p_site_id: SEED.sites.metro, p_shift_type_id: dayShift.id, p_date: rosterDate })).toBe(assignmentId);
      // the shift_assignments_create_shift trigger made the scheduled shift
      const madeShift = await db.from("shifts").select("id,status").eq("assignment_id", assignmentId).single();
      expect(madeShift.data?.status).toBe("scheduled");

      const roster = await rpc<{ id: string; guard_id: string; site_id: string; shift_type: string; shift_status: string }[]>(app, "roster_day", { p_date: rosterDate, p_site_id: SEED.sites.metro });
      const mine = roster.find((r) => r.id === assignmentId)!;
      expect(mine).toMatchObject({ guard_id: guardId, site_id: SEED.sites.metro, shift_type: "Day", shift_status: "scheduled" });

      // ---- 9. staff_guards lists the new hire, scoped to Metro
      const guards = await rpc<{ id: string; site_id: string | null; kyc_complete: boolean; on_duty: boolean }[]>(app, "staff_guards");
      expect(guards.map((g) => g.id)).toContain(guardId);
      expect(guards.every((g) => g.site_id === null || g.site_id === SEED.sites.metro)).toBe(true);
      expect(guards.find((g) => g.id === guardId)).toMatchObject({ kyc_complete: true, on_duty: false });
      expect((await rpc<unknown[]>(app, "staff_guards", { p_site_id: SEED.sites.metro })).length).toBe(guards.filter((g) => g.site_id === SEED.sites.metro).length);

      // ---- 10. create_task with the new guard as assignee
      taskId = await rpc<string>(app, "create_task", {
        p_site_id: SEED.sites.metro, p_title: "E2E gate sweep", p_description: "Walk the perimeter",
        p_due_at: new Date(Date.now() + 3_600_000).toISOString(), p_photo_required: true, p_guard_ids: [guardId],
      });
      const taskRow = await db.from("tasks").select("title,site_id,photo_required,created_by").eq("id", taskId).single();
      expect(taskRow.data).toMatchObject({ title: "E2E gate sweep", site_id: SEED.sites.metro, photo_required: true, created_by: me.profile.id });
      expect((await db.from("task_assignments").select("guard_id").eq("task_id", taskId)).data).toEqual([{ guard_id: guardId }]);
      expect((await app.rpc("create_task", { p_site_id: SEED.sites.prestige, p_title: "Nope" })).error?.message).toContain("FORBIDDEN");

      // ---- 11. leave inbox: pending → decided → gone
      const leaveFrom = agencyDate(90);
      const leave = await db.from("leave_requests").insert({
        agency_id: SEED.agencyId, guard_id: guardId, site_id: SEED.sites.metro, type: "casual",
        start_date: leaveFrom, end_date: leaveFrom, reason: "E2E family function",
      }).select("id").single();
      if (leave.error) throw leave.error;
      leaveId = leave.data.id;
      const inbox = await rpc<{ id: string; guard_id: string; site_name: string; casual_left: number | null }[]>(app, "leave_inbox");
      const item = inbox.find((l) => l.id === leaveId)!;
      expect(item).toBeTruthy();
      expect(item.guard_id).toBe(guardId);
      expect(item.site_name).toContain("Metro");
      expect((await rpc<SupervisorHome>(app, "supervisor_home")).pending_leave).toBeGreaterThan(0);

      expect((await app.rpc("decide_leave", { p_leave_id: leaveId, p_approve: true, p_note: "Approved in the field" })).error).toBeNull();
      expect((await rpc<{ id: string }[]>(app, "leave_inbox")).find((l) => l.id === leaveId)).toBeUndefined();
      expect((await db.from("leave_requests").select("status").eq("id", leaveId).single()).data?.status).toBe("approved");

      // ---- 12. a shift to hang an alert and the corrections on
      const start = new Date(Date.now() - 3 * 3_600_000);
      const shift = await db.from("shifts").insert({
        agency_id: SEED.agencyId, site_id: SEED.sites.metro, guard_id: SEED.guards.gopal, shift_date: agencyDate(),
        scheduled_start: start.toISOString(), scheduled_end: new Date(start.getTime() + 8 * 3_600_000).toISOString(),
        status: "scheduled",
      }).select("id").single();
      if (shift.error) throw shift.error;
      shiftId = shift.data.id;

      // ---- 13. acknowledge_event clears the alert from the home screen
      const ev = await db.from("events").insert({
        agency_id: SEED.agencyId, site_id: SEED.sites.metro, guard_id: SEED.guards.gopal, shift_id: shiftId,
        type: "OUTSIDE_FENCE", severity: "warn", title: "E2E: guard left the fence",
      }).select("id").single();
      if (ev.error) throw ev.error;
      eventId = ev.data.id;
      const withAlert = await rpc<SupervisorHome>(app, "supervisor_home");
      const alert = withAlert.alerts.find((a) => a.id === eventId)!;
      expect(alert).toBeTruthy();
      expect(alert.site_name).toContain("Metro");
      expect(alert.shift_date).toBe(agencyDate()); // carried through from the event's shift

      await rpc<void>(app, "acknowledge_event", { p_event_id: eventId });
      const acked = await db.from("events").select("acknowledged_by,acknowledged_at").eq("id", eventId).single();
      expect(acked.data?.acknowledged_by).toBe(me.profile.id);
      expect((await rpc<SupervisorHome>(app, "supervisor_home")).alerts.find((a) => a.id === eventId)).toBeUndefined();
      await rpc<void>(app, "acknowledge_event", { p_event_id: eventId }); // idempotent

      // ---- 14. corrections: exception then override, both visible in site_shifts
      expect((await app.rpc("log_shift_exception", { p_shift_id: shiftId, p_reason: "Phone battery died at the gate", p_category: "device_failure" })).error).toBeNull();
      expect((await app.rpc("override_attendance", { p_shift_id: shiftId, p_attendance: "present", p_reason: "Verified in person on the round" })).error).toBeNull();
      const corrected = (await rpc<{ id: string; exception_reason: string | null; override_reason: string | null; attendance: string }[]>(app, "site_shifts", { p_site_id: SEED.sites.metro, p_date: agencyDate() })).find((s) => s.id === shiftId)!;
      expect(corrected.exception_reason).toBe("Phone battery died at the gate");
      expect(corrected.override_reason).toBe("Verified in person on the round");
      expect(corrected.attendance).toBe("present");
    } finally {
      if (taskId) {
        await db.from("task_assignments").delete().eq("task_id", taskId);
        await db.from("tasks").delete().eq("id", taskId);
      }
      if (shiftId) {
        await db.from("events").delete().eq("shift_id", shiftId);
        await db.from("shifts").delete().eq("id", shiftId);
      }
      if (eventId) {
        await db.from("notifications").delete().eq("event_id", eventId);
        await db.from("events").delete().eq("id", eventId);
      }
      if (assignmentId) {
        // shifts.assignment_id is ON DELETE SET NULL, so the shift must go first
        await db.from("shifts").delete().eq("assignment_id", assignmentId);
        await db.from("shift_assignments").delete().eq("id", assignmentId);
      }
      if (guardId) {
        if (leaveId) await db.from("leave_requests").delete().eq("id", leaveId);
        await db.from("leave_balances").delete().eq("guard_id", guardId);
        await db.from("notifications").delete().eq("recipient_guard_id", guardId);
        await db.from("events").delete().eq("guard_id", guardId);
        const docs = (await db.from("guard_documents").select("id").eq("guard_id", guardId)).data ?? [];
        if (docs.length) await db.from("document_access_logs").delete().in("document_id", docs.map((d) => d.id));
        await db.from("guard_documents").delete().eq("guard_id", guardId);
        await db.from("guard_invites").delete().eq("guard_id", guardId);
        await db.from("guards").delete().eq("id", guardId);
        await db.storage.from("selfies").remove([`${SEED.agencyId}/selfies/reg/${guardId}.jpg`]);
      }
      if (kycPaths.length) await db.storage.from("kyc-docs").remove(kycPaths);
      await app.auth.signOut();
      await ownerApp.auth.signOut();
    }
  });

  test("Priya sees Prestige and Brigade and nothing of Metro", async () => {
    const app = await signIn(SEED.supervisor.email);
    try {
      const me = await rpc<StaffMe>(app, "staff_me");
      expect(me.profile.full_name).toBe(SEED.supervisor.name);
      expect(me.sites.map((s) => s.id).sort()).toEqual([SEED.sites.brigade, SEED.sites.prestige].sort());
      expect(me.sites.map((s) => s.name)).toEqual([...me.sites.map((s) => s.name)].sort()); // ordered by name

      const home = await rpc<SupervisorHome>(app, "supervisor_home");
      expect(home.sites.map((s) => s.id).sort()).toEqual([SEED.sites.brigade, SEED.sites.prestige].sort());
      expect(home.on_duty.some((g) => g.site_id === SEED.sites.metro)).toBe(false);
      expect(home.alerts.some((a) => a.site_id === SEED.sites.metro)).toBe(false);

      expect((await app.rpc("site_shifts", { p_site_id: SEED.sites.metro, p_date: agencyDate() })).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("guard_record", { p_guard_id: SEED.guards.gopal })).error?.message).toContain("FORBIDDEN");
      // ...and Prestige, which is hers, opens
      expect((await app.rpc("guard_record", { p_guard_id: SEED.guards.ramesh })).error).toBeNull();

      const guards = await rpc<{ site_id: string | null }[]>(app, "staff_guards");
      expect(guards.length).toBeGreaterThan(0);
      expect(guards.some((g) => g.site_id === SEED.sites.metro)).toBe(false);

      const roster = await rpc<{ site_id: string }[]>(app, "roster_day", { p_date: agencyDate() });
      expect(roster.some((r) => r.site_id === SEED.sites.metro)).toBe(false);

      const inbox = await rpc<{ site_id: string | null }[]>(app, "leave_inbox");
      expect(inbox.some((l) => l.site_id === SEED.sites.metro)).toBe(false);
    } finally {
      await app.auth.signOut();
    }
  });

  test("a guard-kind session is not staff", async () => {
    const db = admin();
    const phone = "+919900000013"; // Harish Chandra, SSS-013
    const app = anon();
    await db.from("guards").update({ profile_id: null }).eq("id", SEED.guards.harish);

    let userId: string | null = null;
    try {
      expect((await app.auth.signInWithOtp({ phone })).error).toBeNull();
      const { data, error } = await app.auth.verifyOtp({ phone, token: SEED.guardOtp, type: "sms" });
      expect(error).toBeNull();
      userId = data.session!.user.id;
      expect((await app.rpc("claim_guard_account")).error).toBeNull();

      expect((await app.rpc("staff_me")).error?.message).toContain("NOT_STAFF");
      expect((await app.rpc("supervisor_home")).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("staff_guards")).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("leave_inbox")).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("site_shifts", { p_site_id: SEED.sites.sobha, p_date: agencyDate() })).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("guard_record", { p_guard_id: SEED.guards.harish })).error?.message).toContain("FORBIDDEN");
      expect((await app.rpc("add_guard", { p_full_name: "Nope", p_phone: "9" + String(Date.now()).slice(-9) })).error?.message).toContain("FORBIDDEN");
    } finally {
      await db.from("guards").update({ profile_id: null }).eq("id", SEED.guards.harish);
      if (userId) await db.auth.admin.deleteUser(userId);
    }
  });
});
