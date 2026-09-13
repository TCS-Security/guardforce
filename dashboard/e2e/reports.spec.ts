import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

test.describe("reports", () => {
  test("analytics render with numbers and a per-site table", async ({ page }) => {
    await login(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
    await expect(page.getByText("Attendance rate")).toBeVisible();
    await expect(page.getByText("Prestige Tech Park — Gate 3").first()).toBeVisible();
  });

  test("every CSV export returns rows for the seeded range", async ({ page }) => {
    await login(page);
    const from = agencyDate(-14);
    const to = agencyDate(0);
    const month = to.slice(0, 7);

    const exports = [
      { path: `/reports/export/daily-attendance?from=${from}&to=${to}`, header: "Date" },
      { path: `/reports/export/muster-roll?site=${SEED.sites.prestige}&month=${month}`, header: "Guard" },
      { path: `/reports/export/punch?from=${from}&to=${to}`, header: "Guard" },
      { path: `/reports/export/patrol-compliance?from=${from}&to=${to}`, header: "Site" },
      { path: `/reports/export/leave-register?from=${from}&to=${to}`, header: "Guard" },
    ];

    for (const item of exports) {
      const res = await page.request.get(item.path);
      expect(res.status(), item.path).toBe(200);
      expect(res.headers()["content-type"], item.path).toContain("text/csv");
      const body = await res.text();
      expect(body, item.path).toContain(item.header);
      expect(body.split("\r\n").length, `${item.path} should have data rows`).toBeGreaterThan(2);
    }
  });

  test("guard scorecards list punctuality per guard", async ({ page }) => {
    await login(page);
    await page.goto(`/reports?from=${agencyDate(-14)}&to=${agencyDate(0)}`);
    await expect(page.getByText("Guard scorecards").first()).toBeVisible();
    await expect(page.getByText("Ramesh Yadav").first()).toBeVisible();
  });

  test("the daily digest preview reads like the message an owner would get", async ({ page }) => {
    await login(page);
    await page.goto(`/reports?digest=${agencyDate(-1)}`);
    await expect(page.getByText(/digest/i).first()).toBeVisible();
    await expect(page.getByText("Prestige Tech Park — Gate 3").first()).toBeVisible();
  });
});

test.describe("settings", () => {
  test("an owner can change an agency default and it persists", async ({ page }) => {
    const db = admin();
    await login(page);
    await page.goto("/settings");

    await page.getByLabel("Late threshold (min)").fill("25");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("form-status")).toBeVisible();

    const { data } = await db.from("agencies").select("late_threshold_min").eq("id", SEED.agencyId).single();
    expect(data!.late_threshold_min).toBe(25);

    await page.getByLabel("Late threshold (min)").fill("15");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("form-status")).toBeVisible();
  });

  test("the guard-app config drives what the Android app pulls", async ({ page }) => {
    const db = admin();
    await login(page);
    await page.goto("/settings/app");

    await expect(page.getByText("Minimum app version")).toBeVisible();
    await page.getByLabel("OTA channel").click();
    await page.getByRole("option", { name: "Beta" }).click();
    await page.getByLabel("Feature flags (JSON)").fill('{"alertness_checks":true}');
    await page.getByRole("button", { name: "Save config" }).click();
    await expect(page.getByTestId("form-status")).toBeVisible();

    const { data } = await db.from("app_config").select("ota_channel,features").eq("agency_id", SEED.agencyId).single();
    expect(data!.ota_channel).toBe("beta");
    expect(data!.features).toMatchObject({ alertness_checks: true });

    await db.from("app_config").update({ ota_channel: "production", features: {} }).eq("agency_id", SEED.agencyId);
  });

  test("invalid feature-flag JSON is refused", async ({ page }) => {
    await login(page);
    await page.goto("/settings/app");
    await page.getByLabel("Feature flags (JSON)").fill("not json");
    await page.getByRole("button", { name: "Save config" }).click();
    await expect(page.getByTestId("form-error")).toContainText("JSON object");
  });

  test("the audit log shows who changed what", async ({ page }) => {
    await login(page);
    await page.goto("/settings/audit");
    await expect(page.getByText("Audit trail").first()).toBeVisible();
    await expect(page.getByText(/attendance override|update settings|site created/).first()).toBeVisible();
  });

  test("an owner invites a supervisor, who then sees only their site", async ({ page, browser }) => {
    const db = admin();
    const email = `e2e-sup-${Date.now().toString().slice(-6)}@sentinel.test`;
    await login(page);
    await page.goto("/settings/team");

    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByLabel("Full name").fill("E2E Supervisor");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("checkbox", { name: "Sobha Dream Acres" }).check();
    await page.getByRole("button", { name: "Create login" }).click();

    const password = await page.getByLabel("One-time password").inputValue();
    expect(password.length).toBeGreaterThan(6);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("E2E Supervisor")).toBeVisible();

    const { data: profile } = await db.from("profiles").select("id").eq("email", email).single();
    try {
      const fresh = await browser.newContext();
      const newPage = await fresh.newPage();
      await newPage.goto("/login");
      await newPage.getByLabel("Email").fill(email);
      await newPage.getByLabel("Password").fill(password);
      await newPage.getByRole("button", { name: "Sign in" }).click();
      await newPage.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

      await newPage.goto("/sites");
      await expect(newPage.getByRole("heading", { name: "Sobha Dream Acres", level: 3 })).toBeVisible();
      await expect(newPage.getByRole("heading", { name: "Prestige Tech Park — Gate 3", level: 3 })).toHaveCount(0);
      await fresh.close();
    } finally {
      await db.from("supervisor_sites").delete().eq("profile_id", profile!.id);
      await db.from("notification_preferences").delete().eq("profile_id", profile!.id);
      await db.from("profiles").delete().eq("id", profile!.id);
      await db.auth.admin.deleteUser(profile!.id);
    }
  });

  test("a supervisor sees agency settings read-only", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/settings");
    await expect(page.getByText("Only the owner can edit agency settings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });
});
