import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

/** A weekday far enough ahead that no seeded pattern has materialised a shift there. */
function futureDate(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Removes anything earlier runs may have left behind for Ramesh at Sobha. */
async function clearRameshAtSobha() {
  const db = admin();
  const { data: patterns } = await db.from("roster_patterns").select("id").eq("guard_id", SEED.guards.ramesh).eq("site_id", SEED.sites.sobha);
  const patternIds = (patterns ?? []).map((p) => p.id);
  const { data: assignments } = await db.from("shift_assignments").select("id").eq("guard_id", SEED.guards.ramesh).eq("site_id", SEED.sites.sobha);
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  await db.from("shifts").delete().eq("guard_id", SEED.guards.ramesh).eq("site_id", SEED.sites.sobha);
  if (assignmentIds.length) await db.from("shift_assignments").delete().in("id", assignmentIds);
  if (patternIds.length) await db.from("roster_patterns").delete().in("id", patternIds);
}

test.describe("roster", () => {
  test.beforeEach(clearRameshAtSobha);
  test.afterEach(clearRameshAtSobha);

  test("shows the week grid with seeded assignments and patterns", async ({ page }) => {
    await login(page);
    await page.goto(`/roster?site=${SEED.sites.prestige}`);

    const board = page.getByRole("table", { name: /Roster for Prestige/ });
    await expect(board).toBeVisible();
    await expect(board.getByRole("rowheader", { name: /Day/ })).toBeVisible();
    await expect(board.getByRole("rowheader", { name: /Night/ })).toBeVisible();
    await expect(board.getByText("Ramesh").first()).toBeVisible();

    await expect(page.getByText("Weekly patterns")).toBeVisible();
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
    await expect(page.getByText("Mon, Tue, Wed, Thu, Fri, Sat")).toBeVisible();
  });

  test("assigns a guard for one day and removes them again", async ({ page }) => {
    const day = futureDate(4);
    await login(page);
    await page.goto(`/roster?site=${SEED.sites.sobha}&week=${day}`);

    // Sobha's Day shift needs 2 guards but only Harish is rostered, so there is a slot.
    await page.getByRole("button", { name: `Fill Day on ${day}` }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Search guards").fill("Ramesh");
    await page.getByRole("radio", { name: /Ramesh Yadav/ }).click();
    await page.getByRole("button", { name: "Assign", exact: true }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    const cell = page.getByRole("table", { name: /Roster for Sobha/ }).getByText("Ramesh").first();
    await expect(cell).toBeVisible();

    const { data: created } = await admin()
      .from("shifts")
      .select("id,status")
      .eq("guard_id", SEED.guards.ramesh)
      .eq("site_id", SEED.sites.sobha)
      .eq("shift_date", day)
      .maybeSingle();
    expect(created?.status).toBe("scheduled");

    // remove again
    await page.getByRole("button", { name: /Remove Ramesh Yadav/ }).first().click();
    await expect(page.getByRole("table", { name: /Roster for Sobha/ }).getByText("Ramesh")).toHaveCount(0);
    const { data: gone } = await admin().from("shifts").select("id").eq("id", created!.id).maybeSingle();
    expect(gone).toBeNull();
  });

  test("refuses to roster a guard whose KYC is incomplete (KYC-1)", async ({ page }) => {
    const day = futureDate(5);
    await login(page);
    await page.goto(`/roster?site=${SEED.sites.sobha}&week=${day}`);

    await page.getByRole("button", { name: `Fill Day on ${day}` }).click();
    await page.getByLabel("Search guards").fill("Santosh");

    const option = page.getByRole("radio", { name: /Santosh Kumar/ });
    await expect(option).toBeDisabled();
    await expect(option.getByText("KYC")).toBeVisible();
  });

  test("creates a weekly pattern and ends it", async ({ page }) => {
    const day = futureDate(6);
    await login(page);
    await page.goto(`/roster?site=${SEED.sites.sobha}&week=${day}`);

    await page.getByRole("button", { name: `Fill Day on ${day}` }).click();
    await page.getByLabel("Search guards").fill("Ramesh");
    await page.getByRole("radio", { name: /Ramesh Yadav/ }).click();
    await page.getByRole("checkbox", { name: "Repeat weekly" }).click();
    await page.getByRole("button", { name: "Create pattern" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const patterns = page.getByText("Weekly patterns").locator("xpath=ancestor::section");
    await expect(patterns.getByText("Ramesh Yadav")).toBeVisible();

    const { data: pattern } = await admin()
      .from("roster_patterns")
      .select("id")
      .eq("guard_id", SEED.guards.ramesh)
      .eq("site_id", SEED.sites.sobha)
      .maybeSingle();
    expect(pattern).not.toBeNull();

    await patterns.getByRole("button", { name: "Stop repeating" }).first().click();
    await expect(patterns.getByText("ends today")).toBeVisible();

  });

  test("supervisor cannot open a site outside their scope", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/roster");
    const options = page.getByRole("combobox", { name: "Site" });
    await expect(options).toBeVisible();
    await options.click();
    await expect(page.getByRole("option", { name: "Prestige Tech Park — Gate 3" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Metro Cash & Carry, Yeshwanthpur" })).toHaveCount(0);
  });
});
