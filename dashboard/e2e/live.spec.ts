import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

const SOBHA = { lat: 12.9342, lng: 77.7278 };

async function startShift() {
  const db = admin();
  const now = new Date();
  const { data: shift, error } = await db
    .from("shifts")
    .insert({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.sobha,
      guard_id: SEED.guards.harish,
      shift_date: now.toISOString().slice(0, 10),
      scheduled_start: new Date(now.getTime() - 20 * 60_000).toISOString(),
      scheduled_end: new Date(now.getTime() + 7 * 3600_000).toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error) throw error;

  await db.rpc("check_in", {
    p_guard_id: SEED.guards.harish,
    p_site_id: SEED.sites.sobha,
    p_lat: SOBHA.lat,
    p_lng: SOBHA.lng,
    p_accuracy_m: 6,
    p_selfie_path: "live-test.jpg",
    p_captured_at: new Date().toISOString(),
    p_device: { battery_pct: 91 },
    p_shift_id: shift.id,
  });
  return shift.id;
}

async function cleanup(shiftId: string) {
  const db = admin();
  const { data: patrols } = await db.from("patrols").select("id").eq("shift_id", shiftId);
  if (patrols?.length) await db.from("patrol_photos").delete().in("patrol_id", patrols.map((p) => p.id));
  await db.from("patrols").delete().eq("shift_id", shiftId);
  await db.from("location_pings").delete().eq("shift_id", shiftId);
  const { data: events } = await db.from("events").select("id").eq("shift_id", shiftId);
  if (events?.length) await db.from("notifications").delete().in("event_id", events.map((e) => e.id));
  await db.from("events").delete().eq("shift_id", shiftId);
  await db.from("guard_presence").delete().eq("guard_id", SEED.guards.harish);
  await db.from("shifts").delete().eq("id", shiftId);
}

test.describe("live map", () => {
  test("shows on-duty guards grouped by site with a status count strip", async ({ page }) => {
    await login(page);
    await page.goto("/live");
    await expect(page.getByText("On duty")).toBeVisible();
    await expect(page.getByLabel("Search on-duty guards")).toBeVisible();
    await expect(page.getByTestId("map")).toBeVisible();
  });

  test("a guard checking in appears on the map, then leaves when the shift ends", async ({ page }) => {
    await login(page);
    await page.goto("/live");
    await expect(page.getByTestId("map")).toBeVisible();

    const shiftId = await startShift();
    try {
      // Realtime should bring him in without a reload.
      await expect(page.getByText("Harish Chandra")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: /Harish Chandra —/ })).toBeVisible();

      // Turning location off flips his pill.
      await admin().rpc("report_location_state", { p_shift_id: shiftId, p_enabled: false, p_at: new Date().toISOString() });
      await expect(page.getByText("loc off")).toBeVisible({ timeout: 20_000 });

      // Checking out removes him from the board.
      await admin().rpc("check_out", {
        p_shift_id: shiftId,
        p_lat: SOBHA.lat,
        p_lng: SOBHA.lng,
        p_accuracy_m: 9,
        p_selfie_path: "live-out.jpg",
        p_captured_at: new Date().toISOString(),
        p_device: { battery_pct: 80 },
      });
      await expect(page.getByText("Harish Chandra")).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await cleanup(shiftId);
    }
  });

  test("filtering to a site narrows the panel", async ({ page }) => {
    await login(page);
    await page.goto(`/live?site=${SEED.sites.metro}`);
    await expect(page.getByText("Metro Cash & Carry, Yeshwanthpur").first()).toBeVisible();
    await expect(page.getByText("Prestige Tech Park — Gate 3")).toHaveCount(0);
  });

  test("supervisor only sees their own sites", async ({ page }) => {
    await login(page, SEED.supervisor2);
    await page.goto("/live");
    await expect(page.getByRole("button", { name: "Metro Cash & Carry, Yeshwanthpur" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prestige Tech Park" })).toHaveCount(0);
  });
});
