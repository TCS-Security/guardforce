import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

/**
 * The guard app is not part of this repo yet, so these tests drive the same SQL RPCs the
 * app will call (check_in, ingest_pings, report_location_state, check_out) with the
 * service-role client and assert what the dashboard shows.
 */
const SOBHA = { lat: 12.9342, lng: 77.7278 };
const OUTSIDE = { lat: 12.9420, lng: 77.7360 }; // ~1 km north-east of the fence

async function createTestShift() {
  const db = admin();
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);
  const end = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const { data, error } = await db
    .from("shifts")
    .insert({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.sobha,
      guard_id: SEED.guards.harish,
      shift_date: start.toISOString().slice(0, 10),
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: "scheduled",
    })
    .select("id,shift_date")
    .single();
  if (error) throw error;
  return data;
}

async function destroyTestShift(shiftId: string) {
  const db = admin();
  await db.from("patrol_photos").delete().in("patrol_id", ((await db.from("patrols").select("id").eq("shift_id", shiftId)).data ?? []).map((p) => p.id));
  await db.from("patrols").delete().eq("shift_id", shiftId);
  await db.from("location_pings").delete().eq("shift_id", shiftId);
  await db.from("notifications").delete().in("event_id", ((await db.from("events").select("id").eq("shift_id", shiftId)).data ?? []).map((e) => e.id));
  await db.from("events").delete().eq("shift_id", shiftId);
  await db.from("shift_exceptions").delete().eq("shift_id", shiftId);
  await db.from("shifts").update({ exception_id: null }).eq("id", shiftId);
  await db.from("shifts").delete().eq("id", shiftId);
}

test.describe("attendance", () => {
  test("day view lists shifts with a summary", async ({ page }) => {
    await login(page);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/attendance?date=${yesterday}`);

    await expect(page.getByRole("heading", { name: "Attendance", level: 1 })).toBeVisible();
    await expect(page.getByRole("table", { name: "Attendance" })).toBeVisible();
    await expect(page.getByText("Present", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Attendance" }).getByRole("row")).not.toHaveCount(1);
  });

  test("filters by site and status", async ({ page }) => {
    await login(page);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/attendance?date=${yesterday}&site=${SEED.sites.metro}`);
    const table = page.getByRole("table", { name: "Attendance" });
    await expect(table.getByText("Metro Cash & Carry, Yeshwanthpur").first()).toBeVisible();
    await expect(table.getByText("Brigade Meadows")).toHaveCount(0);
  });

  test("a full verified shift: check in, wander out, lose location, void, then rescue with an exception", async ({ page }) => {
    const db = admin();
    const shift = await createTestShift();
    try {
      // ---- check in from inside the fence with a selfie (ATT-1)
      const { error: inError } = await db.rpc("check_in", {
        p_guard_id: SEED.guards.harish,
        p_site_id: SEED.sites.sobha,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_accuracy_m: 8,
        p_selfie_path: `${SEED.agencyId}/selfies/${shift.id}/start.jpg`,
        p_captured_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        p_device: { battery_pct: 84, model: "Redmi 9A", app_version: "1.0.0", is_mock: false },
        p_shift_id: shift.id,
      });
      expect(inError).toBeNull();

      await login(page);
      await page.goto(`/attendance/${shift.id}`);
      await expect(page.getByText("On duty")).toBeVisible();
      await expect(page.getByText("Inside").first()).toBeVisible();

      // ---- wander outside the fence, then come back (BRK-1)
      const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60 * 1000).toISOString();
      await db.rpc("ingest_pings", {
        p_shift_id: shift.id,
        p_pings: [
          { recorded_at: t(50), lat: SOBHA.lat, lng: SOBHA.lng, accuracy_m: 9, battery_pct: 82 },
          { recorded_at: t(40), lat: OUTSIDE.lat, lng: OUTSIDE.lng, accuracy_m: 12, battery_pct: 80 },
          { recorded_at: t(25), lat: OUTSIDE.lat, lng: OUTSIDE.lng, accuracy_m: 12, battery_pct: 78 },
          { recorded_at: t(15), lat: SOBHA.lat, lng: SOBHA.lng, accuracy_m: 10, battery_pct: 77 },
        ],
      });

      await page.reload();
      await expect(page.getByText("Away from site")).toBeVisible();
      await expect(page.getByText(/trips? out · longest/)).toBeVisible();
      await expect(page.getByText("Fence exit")).toBeVisible();

      // ---- guard switches location off and never turns it back on (LOC-1)
      await db.rpc("report_location_state", { p_shift_id: shift.id, p_enabled: false, p_at: t(10) });
      const { error: outError } = await db.rpc("check_out", {
        p_shift_id: shift.id,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_accuracy_m: 11,
        p_selfie_path: `${SEED.agencyId}/selfies/${shift.id}/end.jpg`,
        p_captured_at: new Date().toISOString(),
        p_device: { battery_pct: 70 },
      });
      expect(outError).toBeNull();

      const { data: voided } = await db.from("shifts").select("status,attendance").eq("id", shift.id).single();
      expect(voided).toMatchObject({ status: "void_location_off", attendance: "absent" });

      await page.reload();
      await expect(page.getByText("Shift void — location was off.")).toBeVisible();

      // ---- manager logs a documented exception (LOC-3)
      await page.getByRole("button", { name: "Log an exception" }).click();
      await page.getByLabel("Details").fill("Handset battery died at the post; client security desk confirmed he stayed until the end.");
      await page.getByRole("button", { name: "Log exception" }).click();

      await expect(page.getByText("Exception logged (device failure)").first()).toBeVisible();
      const { data: rescued } = await db.from("shifts").select("status,attendance,exception_id").eq("id", shift.id).single();
      expect(rescued!.status).toBe("completed");
      expect(rescued!.exception_id).not.toBeNull();

      // ---- and corrects the attendance, which must be audited (AUD-1)
      await page.getByRole("button", { name: "Correct attendance" }).click();
      await page.getByRole("combobox", { name: "Mark as" }).click();
      await page.getByRole("option", { name: "Present" }).click();
      await page.getByLabel("Reason").fill("Full shift worked; verified with the client.");
      await page.getByRole("button", { name: "Save correction" }).click();

      await expect(page.getByText("Attendance corrected to present.")).toBeVisible();
      const { data: audit } = await db
        .from("audit_logs")
        .select("action,reason")
        .eq("entity_type", "shift")
        .eq("entity_id", shift.id)
        .eq("action", "attendance_override")
        .maybeSingle();
      expect(audit?.reason).toContain("verified with the client");
    } finally {
      await destroyTestShift(shift.id);
    }
  });

  test("blocks a check-in from a mocked location (ATT-3)", async () => {
    const db = admin();
    const shift = await createTestShift();
    try {
      const { error } = await db.rpc("check_in", {
        p_guard_id: SEED.guards.harish,
        p_site_id: SEED.sites.sobha,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_accuracy_m: 6,
        p_selfie_path: "x.jpg",
        p_captured_at: new Date().toISOString(),
        p_device: { battery_pct: 90, is_mock: true },
        p_shift_id: shift.id,
      });
      expect(error?.message).toContain("TAMPER_SUSPECTED");

      const { data: still } = await db.from("shifts").select("status").eq("id", shift.id).single();
      expect(still!.status).toBe("scheduled");

      // The block rolls back its own transaction, so the app reports the attempt separately.
      const { error: reportError } = await db.rpc("report_tamper", {
        p_guard_id: SEED.guards.harish,
        p_site_id: SEED.sites.sobha,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_detail: "mock provider",
      });
      expect(reportError).toBeNull();

      const { data: events } = await db
        .from("events")
        .select("type,severity")
        .eq("guard_id", SEED.guards.harish)
        .eq("type", "TAMPER_SUSPECTED")
        .gte("created_at", new Date(Date.now() - 60_000).toISOString());
      expect(events?.length).toBeGreaterThan(0);
    } finally {
      const db2 = admin();
      await db2.from("events").delete().eq("guard_id", SEED.guards.harish).eq("type", "TAMPER_SUSPECTED").gte("created_at", new Date(Date.now() - 300_000).toISOString());
      await destroyTestShift(shift.id);
    }
  });

  test("refuses a check-in without a selfie (ATT-1)", async () => {
    const db = admin();
    const shift = await createTestShift();
    try {
      const { error } = await db.rpc("check_in", {
        p_guard_id: SEED.guards.harish,
        p_site_id: SEED.sites.sobha,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_accuracy_m: 6,
        p_selfie_path: null as unknown as string,
        p_captured_at: new Date().toISOString(),
        p_device: {},
        p_shift_id: shift.id,
      });
      expect(error?.message).toContain("SELFIE_REQUIRED");
    } finally {
      await destroyTestShift(shift.id);
    }
  });

  test("flags a check-in from outside the buffered fence but still allows it (ATT-2)", async ({ page }) => {
    const db = admin();
    const shift = await createTestShift();
    try {
      const { error } = await db.rpc("check_in", {
        p_guard_id: SEED.guards.harish,
        p_site_id: SEED.sites.sobha,
        p_lat: OUTSIDE.lat,
        p_lng: OUTSIDE.lng,
        p_accuracy_m: 14,
        p_selfie_path: "outside.jpg",
        p_captured_at: new Date().toISOString(),
        p_device: { battery_pct: 60 },
        p_shift_id: shift.id,
      });
      expect(error).toBeNull();

      const { data: row } = await db.from("shifts").select("status,flags,trust,start_in_fence").eq("id", shift.id).single();
      expect(row!.status).toBe("in_progress");
      expect(row!.start_in_fence).toBe(false);
      expect(row!.flags).toContain("OUTSIDE_FENCE");
      expect(row!.trust).toBe("flagged");

      await login(page);
      await page.goto(`/attendance/${shift.id}`);
      await expect(page.getByText(/^Outside by /)).toBeVisible();
      await expect(page.getByText("Flagged")).toBeVisible();
    } finally {
      await destroyTestShift(shift.id);
    }
  });
});
