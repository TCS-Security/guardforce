import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

/** Splits one CSV record, honouring the quoting the export uses for names with commas. */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cell); cell = ""; }
    else cell += ch;
  }
  out.push(cell);
  // The export writes a UTF-8 BOM so Excel reads Indian names correctly.
  if (out.length) out[0] = out[0]!.replace(/^\uFEFF/, "");
  return out;
}

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

    // The same reports as a real spreadsheet: a zip (PK magic bytes) served as xlsx.
    for (const item of exports) {
      const path = `${item.path}&format=xlsx`;
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toContain("spreadsheetml.sheet");
      expect(res.headers()["content-disposition"], path).toContain(".xlsx");
      const body = await res.body();
      expect(body.length, path).toBeGreaterThan(500);
      expect([...body.subarray(0, 2)], `${path} is a zip`).toEqual([0x50, 0x4b]);
      // The sheet XML is deflated inside, but the part names are stored in the clear.
      expect(body.toString("latin1"), path).toContain("xl/worksheets/sheet1.xml");
    }
  });

  test("dates read DD-MM-YY, times HH:MM, and worked time is in hours", async ({ page }) => {
    await login(page);
    const from = agencyDate(-14);
    const to = agencyDate(0);
    const body = await (await page.request.get(`/reports/export/daily-attendance?from=${from}&to=${to}`)).text();
    const [header, ...rows] = body.trim().split("\r\n").map(parseCsvRow);

    expect(header).toContain("Worked (h)");
    expect(header.join(",")).not.toMatch(/accuracy/i);
    expect(header.join(",")).not.toMatch(/latitude|longitude/i);

    const at = (name: string) => {
      const i = header.indexOf(name);
      expect(i, `column ${name}`).toBeGreaterThanOrEqual(0);
      return i;
    };
    const dateCol = at("Date");
    const inCol = at("In");
    const workedCol = at("Worked (h)");

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row[dateCol], "date is DD-MM-YY").toMatch(/^\d{2}-\d{2}-\d{2}$/);
      if (row[inCol]) expect(row[inCol], "time is HH:MM, never seconds").toMatch(/^\d{2}:\d{2}$/);
      // Hours, not minutes: a shift reads 8.5, not 510.
      if (row[workedCol]) expect(Number(row[workedCol])).toBeLessThan(24);
    }
  });

  test("a check-in is a map link, not raw coordinates", async ({ page }) => {
    await login(page);
    const from = agencyDate(-14);
    const to = agencyDate(0);
    const body = await (await page.request.get(`/reports/export/punch?from=${from}&to=${to}`)).text();
    const link = /https:\/\/www\.google\.com\/maps\?q=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(body);
    expect(link, "punch export carries a Google Maps link").not.toBeNull();

    // The pin matches the fix the database stored for that shift.
    const [, lat, lng] = link!;
    const { data } = await admin()
      .from("shifts")
      .select("id")
      .gte("shift_date", from)
      .lte("shift_date", to)
      .eq("start_lat", Number(lat))
      .eq("start_lng", Number(lng))
      .limit(1);
    expect(data!.length, "the link's coordinates belong to a real shift").toBeGreaterThan(0);
  });

  test("identity columns stay put when a report is scrolled sideways", async ({ page }) => {
    await login(page);
    await page.goto(`/reports?from=${agencyDate(-14)}&to=${agencyDate(0)}`);
    const table = page.getByRole("table", { name: "Guard scorecards" });
    await expect(table).toBeVisible();

    const firstCell = table.locator("tbody tr").first().locator("td").first();
    await expect(firstCell).toBeVisible();
    const before = (await firstCell.boundingBox())!;

    const scroller = table.locator("xpath=ancestor::div[1]");
    await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect
      .poll(async () => (await scroller.evaluate((el: HTMLElement) => el.scrollLeft)))
      .toBeGreaterThan(0);

    // Pinned: the guard column has not moved with the scroll.
    const after = (await firstCell.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
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

  test("a supervisor has no settings access at all", async ({ page }) => {
    await login(page, SEED.supervisor);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await page.goto("/settings");
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});
