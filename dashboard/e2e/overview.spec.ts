import { test, expect } from "@playwright/test";
import { login } from "./helpers";

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
});
