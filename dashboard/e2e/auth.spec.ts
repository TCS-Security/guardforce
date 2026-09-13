import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

test.describe("auth", () => {
  test("redirects signed-out users to login with a next param", async ({ page }) => {
    await page.goto("/guards");
    await expect(page).toHaveURL(/\/login\?next=%2Fguards/);
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(SEED.owner.email);
    await page.getByLabel("Password").fill("nope-nope");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
  });

  test("owner signs in, sees the overview, and signs out", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rajesh");
    await expect(page.getByText("On duty now")).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("supervisor only sees scoped sites on the overview", async ({ page }) => {
    await login(page, SEED.supervisor);
    const board = page.getByRole("table", { name: "Site staffing" });
    await expect(board.getByRole("link", { name: "Prestige Tech Park — Gate 3" })).toBeVisible();
    await expect(board.getByRole("link", { name: "Brigade Meadows" })).toBeVisible();
    await expect(board.getByRole("link", { name: "Metro Cash & Carry, Yeshwanthpur" })).toHaveCount(0);
    await expect(board.getByRole("link", { name: "Sobha Dream Acres" })).toHaveCount(0);
  });
});
