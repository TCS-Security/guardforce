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
});
