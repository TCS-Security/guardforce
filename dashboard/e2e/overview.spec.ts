import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

test.describe("overview", () => {
  test("shows staffing, trend and alerts", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Site staffing right now")).toBeVisible();
    await expect(page.getByText("Attendance, last 14 days")).toBeVisible();
    await expect(page.getByText("Live alerts")).toBeVisible();
    // every seeded active site appears
    const board = page.getByRole("table", { name: "Site staffing" });
    for (const name of ["Prestige Tech Park — Gate 3", "Brigade Meadows", "Metro Cash & Carry, Yeshwanthpur", "Sobha Dream Acres"]) {
      await expect(board.getByRole("link", { name })).toBeVisible();
    }
    // the alerts bell reports unread alerts
    await expect(page.getByRole("button", { name: /Alerts, \d+ unread/ })).toBeVisible();
  });

  test("navigates to a site from the staffing board", async ({ page }) => {
    await login(page);
    await page.getByRole("table", { name: "Site staffing" }).getByRole("link", { name: "Brigade Meadows" }).click();
    await expect(page).toHaveURL(/\/sites\/c0000000-0000-4000-8000-000000000002/);
  });

  // Regression: the staffing table's min-content and the `1fr` alert column used to
  // hold the page open, so every width below 600px — and 1280 exactly — scrolled sideways.
  for (const width of [390, 768, 1024, 1280, 1440]) {
    test(`has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      await expect(page.getByRole("table", { name: "Site staffing" })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page scrolls horizontally at ${width}px`).toBe(0);
    });
  }

  test("the trend chart legend stays inside its card", async ({ page }) => {
    await login(page);
    const card = page.getByText("Attendance, last 14 days").locator("xpath=ancestor::section[1]");
    const legend = card.getByText("On leave");
    const [cardBox, legendBox] = [await card.boundingBox(), await legend.boundingBox()];
    expect(legendBox!.y + legendBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
  });

  // Repeats of one problem used to take one panel slot each: three missed rounds for the same
  // guard on the same route rendered as three visually identical lines.
  test("collapses repeats of the same problem into one alert row", async ({ page }) => {
    const db = admin();
    const patrolIds = ["11111111-1111-4111-8111-000000000101", "11111111-1111-4111-8111-000000000102", "11111111-1111-4111-8111-000000000103"];
    const routeId = "f0000000-0000-4000-8000-000000000001";
    const rows = patrolIds.map((patrolId, i) => ({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.prestige,
      guard_id: SEED.guards.ramesh,
      type: "PATROL_MISSED",
      severity: "warn",
      title: "Ramesh Yadav missed patrol Dedupe test round",
      payload: { patrol_id: patrolId, route_id: routeId, route_name: "Dedupe test round", body: `Expected 0${i + 1}:00` },
      created_at: new Date(Date.now() - (2 + i) * 60_000).toISOString(),
    }));
    const TITLE = "Ramesh Yadav missed patrol Dedupe test round";
    await db.from("events").delete().eq("title", TITLE);
    const { error } = await db.from("events").insert(rows);
    expect(error).toBeNull();

    try {
      await login(page);
      const group = page.locator('[data-testid="alert-group"]', { hasText: "Dedupe test round" });
      await expect(group).toHaveCount(1);
      await expect(group).toHaveAttribute("data-count", "3");
      await expect(group).toContainText("missed 3 patrol rounds");

      // The distinguishing detail of the newest event is on screen, not hidden in muted text.
      await expect(group).toContainText("Expected 01:00");

      // Expanding lists every underlying round.
      await group.getByRole("button", { name: "All 3" }).click();
      await expect(group.getByRole("link", { name: /Expected 0\d:00/ })).toHaveCount(3);
    } finally {
      await db.from("events").delete().eq("title", TITLE);
    }
  });
});
