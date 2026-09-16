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

  // The KYC block was withdrawn: agencies roster a guard on day one and chase the
  // paperwork afterwards. The gap is still shown, it just no longer stops the assignment.
  test("rosters a guard whose KYC is incomplete, while still flagging the gap", async ({ page }) => {
    const db = admin();
    const day = futureDate(5);
    await db.from("shifts").delete().eq("guard_id", SEED.guards.santoshIncompleteKyc).eq("shift_date", day);
    await db.from("shift_assignments").delete().eq("guard_id", SEED.guards.santoshIncompleteKyc).eq("shift_date", day);

    try {
      await login(page);
      await page.goto(`/roster?site=${SEED.sites.sobha}&week=${day}`);
      await page.getByRole("button", { name: `Fill Day on ${day}` }).click();
      await page.getByLabel("Search guards").fill("Santosh");

      const option = page.getByRole("radio", { name: /Santosh Kumar/ });
      await expect(option).toBeEnabled();
      // The KYC gap is still surfaced, as information.
      await expect(option.getByText("KYC")).toBeVisible();

      await option.click();
      // The warning informs; it does not disable the thing you came here to press.
      // Each gap is a whole statement, listed rather than spliced into the prose —
      // reading them into the sentence produced "short of police verification missing".
      const warning = page.getByText(/can be rostered\. KYC still incomplete:/);
      await expect(warning).toBeVisible();
      await expect(warning).toContainText("Police verification missing");
      const submit = page.getByRole("button", { name: "Assign" });
      await expect(submit).toBeEnabled();
      await submit.click();

      // The server accepted it: the assignment row exists, and a shift was materialised.
      await expect(async () => {
        const { data } = await db
          .from("shift_assignments")
          .select("id")
          .eq("guard_id", SEED.guards.santoshIncompleteKyc)
          .eq("shift_date", day);
        expect(data!.length, "assignment row").toBeGreaterThan(0);
      }).toPass({ timeout: 15_000 });

      // And the operator sees it land: the dialog closes with no error, and the guard
      // is on the grid. Asserting the row alone would still pass if the UI swallowed
      // a P0001 from a database that has not had 0014 applied.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(/KYC_INCOMPLETE|cannot be rostered/)).toHaveCount(0);
      await expect(
        page.getByRole("table", { name: /Roster for Sobha/ }).getByText("Santosh"),
      ).toBeVisible();
    } finally {
      await db.from("shifts").delete().eq("guard_id", SEED.guards.santoshIncompleteKyc).eq("shift_date", day);
      await db.from("shift_assignments").delete().eq("guard_id", SEED.guards.santoshIncompleteKyc).eq("shift_date", day);
    }
  });

  test("the database no longer refuses an incomplete-KYC assignment", async () => {
    const db = admin();
    const day = futureDate(7);
    const { data: shiftType } = await db.from("shift_types").select("id").eq("site_id", SEED.sites.sobha).limit(1).single();
    await db.from("shift_assignments").delete().eq("guard_id", SEED.guards.rajniIncompleteKyc).eq("shift_date", day);

    const { error } = await db.from("shift_assignments").insert({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.sobha,
      guard_id: SEED.guards.rajniIncompleteKyc,
      shift_type_id: shiftType!.id,
      shift_date: day,
      scheduled_start: `${day}T02:30:00Z`,
      scheduled_end: `${day}T10:30:00Z`,
    });
    expect(error, "the KYC trigger should be gone").toBeNull();

    await db.from("shifts").delete().eq("guard_id", SEED.guards.rajniIncompleteKyc).eq("shift_date", day);
    await db.from("shift_assignments").delete().eq("guard_id", SEED.guards.rajniIncompleteKyc).eq("shift_date", day);
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
