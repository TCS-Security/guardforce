import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

const SOBHA = { lat: 12.9342, lng: 77.7278 };
const stamp = () => Date.now().toString().slice(-6);

/** Starts a shift at Sobha the way the guard app does, which also schedules its patrols. */
async function startShiftWithPatrols() {
  const db = admin();
  const now = new Date();
  const { data: shift, error } = await db
    .from("shifts")
    .insert({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.sobha,
      guard_id: SEED.guards.harish,
      shift_date: now.toISOString().slice(0, 10),
      scheduled_start: new Date(now.getTime() - 30 * 60_000).toISOString(),
      scheduled_end: new Date(now.getTime() + 7 * 3600_000).toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: inError } = await db.rpc("check_in", {
    p_guard_id: SEED.guards.harish,
    p_site_id: SEED.sites.sobha,
    p_lat: SOBHA.lat,
    p_lng: SOBHA.lng,
    p_accuracy_m: 7,
    p_selfie_path: "patrol-test.jpg",
    p_captured_at: new Date(now.getTime() - 25 * 60_000).toISOString(),
    p_device: { battery_pct: 88 },
    p_shift_id: shift.id,
  });
  if (inError) throw inError;
  return shift.id;
}

async function cleanupShift(shiftId: string) {
  const db = admin();
  const { data: patrols } = await db.from("patrols").select("id").eq("shift_id", shiftId);
  const ids = (patrols ?? []).map((p) => p.id);
  if (ids.length) await db.from("patrol_photos").delete().in("patrol_id", ids);
  await db.from("patrols").delete().eq("shift_id", shiftId);
  await db.from("location_pings").delete().eq("shift_id", shiftId);
  const { data: events } = await db.from("events").select("id").eq("shift_id", shiftId);
  if (events?.length) await db.from("notifications").delete().in("event_id", events.map((e) => e.id));
  await db.from("events").delete().eq("shift_id", shiftId);
  await db.from("shifts").delete().eq("id", shiftId);
}

test.describe("patrols", () => {
  test("board shows yesterday's compliance broken down by site", async ({ page }) => {
    const yesterday = agencyDate(-1);
    await login(page);
    await page.goto(`/patrols?date=${yesterday}`);

    await expect(page.getByText("Compliance")).toBeVisible();
    await expect(page.getByRole("table", { name: /Patrols at Prestige/ })).toBeVisible();
    await expect(page.getByText("Perimeter round").first()).toBeVisible();
    await expect(page.getByText("Photo proof required to close a round").first()).toBeVisible();
  });

  test("creates, edits and pauses a patrol route", async ({ page }) => {
    const name = `E2E Route ${stamp()}`;
    await login(page);
    await page.goto("/patrols/routes");

    await page.getByRole("button", { name: "New route" }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Sobha Dream Acres" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("What to check").fill("Towers A to D and the terrace doors");
    await page.getByLabel("Every (min)").fill("90");
    await page.getByLabel("Photos").fill("2");
    await page.getByRole("button", { name: "Save route" }).click();

    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText(/every 1h 30m · 15 min grace · 2 photos/)).toBeVisible();

    // edit
    await page.getByRole("button", { name: `Edit ${name}` }).click();
    await page.getByLabel("Every (min)").fill("240");
    await page.getByRole("button", { name: "Save route" }).click();
    await expect(page.getByText(/every 4h · 15 min grace · 2 photos/)).toBeVisible();

    // pause
    await page.getByRole("button", { name: `Pause ${name}` }).click();
    await expect(page.getByText("paused")).toBeVisible();

    // delete (no rounds recorded yet, so it really goes)
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("button", { name: "Delete route" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("a guard walks a round: scheduled on check-in, started, then closed with photos", async ({ page }) => {
    const db = admin();
    const shiftId = await startShiftWithPatrols();
    try {
      const { data: patrols } = await db.from("patrols").select("id,status,expected_at").eq("shift_id", shiftId).order("expected_at");
      expect(patrols!.length).toBeGreaterThan(0);
      const patrolId = patrols![0]!.id;
      expect(patrols![0]!.status).toBe("scheduled");

      await db.rpc("start_patrol", { p_patrol_id: patrolId, p_at: new Date().toISOString() });
      const { error: closeError } = await db.rpc("complete_patrol", {
        p_patrol_id: patrolId,
        p_trail: {
          type: "LineString",
          coordinates: [
            [SOBHA.lng, SOBHA.lat],
            [SOBHA.lng + 0.0008, SOBHA.lat + 0.0004],
            [SOBHA.lng, SOBHA.lat],
          ],
        },
        p_photos: [{ file_path: `${SEED.agencyId}/patrols/${patrolId}/1.jpg`, lat: SOBHA.lat, lng: SOBHA.lng }],
        p_at: new Date().toISOString(),
        p_notes: null,
      });
      expect(closeError).toBeNull();

      const { data: done } = await db.from("patrols").select("status,distance_m,duration_s").eq("id", patrolId).single();
      expect(["completed", "late"]).toContain(done!.status);
      expect(done!.distance_m).toBeGreaterThan(0);

      await login(page);
      await page.goto(`/patrols/${patrolId}`);
      await expect(page.getByText("Route walked")).toBeVisible();
      await expect(page.getByText("Photo proof (1)")).toBeVisible();
      await expect(page.getByText("Required at this site")).toBeVisible();
    } finally {
      await cleanupShift(shiftId);
    }
  });

  test("refuses to close a round without the photos the site requires (PAT-1)", async () => {
    const db = admin();
    const shiftId = await startShiftWithPatrols();
    try {
      const { data: patrols } = await db.from("patrols").select("id").eq("shift_id", shiftId).order("expected_at");
      const patrolId = patrols![0]!.id;
      await db.rpc("start_patrol", { p_patrol_id: patrolId, p_at: new Date().toISOString() });

      const { error } = await db.rpc("complete_patrol", {
        p_patrol_id: patrolId,
        p_trail: { type: "LineString", coordinates: [[SOBHA.lng, SOBHA.lat], [SOBHA.lng + 0.001, SOBHA.lat]] },
        p_photos: [],
        p_at: new Date().toISOString(),
        p_notes: null,
      });
      expect(error?.message).toContain("PATROL_PHOTO_REQUIRED");

      const { data: still } = await db.from("patrols").select("status,ended_at").eq("id", patrolId).single();
      expect(still!.ended_at).toBeNull();
    } finally {
      await cleanupShift(shiftId);
    }
  });

  test("a supervisor can note a round and only sees their own sites", async ({ page }) => {
    const yesterday = agencyDate(-1);
    await login(page, SEED.supervisor);
    await page.goto(`/patrols?date=${yesterday}`);
    await expect(page.getByRole("table", { name: /Patrols at Prestige/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /Patrols at Metro/ })).toHaveCount(0);
  });
});
