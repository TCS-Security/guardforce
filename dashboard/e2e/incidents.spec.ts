import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

/** The seeded demo incidents, so a test can lean on one without creating it. */
const SEEDED = {
  theftOpen: "11000000-0000-4000-8000-000000000001",
  trespassInvestigating: "11000000-0000-4000-8000-000000000002",
  fightResolved: "11000000-0000-4000-8000-000000000003",
};

/** Anything a test logs is titled with this, so cleanup never touches the seed. */
const MARK = "E2E incident";

async function clearLoggedIncidents() {
  await admin().from("incidents").delete().like("title", `${MARK}%`);
}

test.describe("incidents", () => {
  test.beforeEach(clearLoggedIncidents);
  test.afterEach(clearLoggedIncidents);

  test("lists the incidents an owner needs to see, worst first", async ({ page }) => {
    await login(page);
    await page.goto("/incidents");
    await expect(page.getByRole("heading", { name: "Incidents", level: 1 })).toBeVisible();

    const table = page.getByRole("table", { name: "Incidents" });
    await expect(table.getByRole("link", { name: /Two laptops taken/ })).toBeVisible();
    await expect(table.getByRole("link", { name: /Four men entered/ })).toBeVisible();
    await expect(table.getByRole("link", { name: /Fight between two loaders/ })).toBeVisible();
  });

  test("logging an incident puts a row in the database and on the page", async ({ page }) => {
    await login(page);
    await page.goto("/incidents");
    await page.getByRole("button", { name: "Log incident" }).click();

    const title = `${MARK} — chain snatched at the gate`;
    // The page's own filter bar also has a "Site" control, so stay inside the dialog.
    const form = page.getByRole("dialog");
    await form.getByLabel("Site").click();
    await page.getByRole("option", { name: "Prestige Tech Park — Gate 3" }).click();
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("What happened, in full").fill("A two-wheeler rider snatched a chain from a visitor at the gate and rode off towards the main road.");
    await form.getByRole("button", { name: "Log incident" }).click();

    // The server wrote it: the row exists, scoped to the right agency and site.
    await expect(async () => {
      const { data } = await admin().from("incidents").select("id,site_id,agency_id,status").eq("title", title).maybeSingle();
      expect(data, "incident row").not.toBeNull();
      expect(data!.site_id).toBe(SEED.sites.prestige);
      expect(data!.agency_id).toBe(SEED.agencyId);
      expect(data!.status).toBe("open");
    }).toPass({ timeout: 15_000 });

    // Logging drops you on the new incident, then it is in the list too.
    await expect(page).toHaveURL(/\/incidents\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: new RegExp(MARK) })).toBeVisible();
    await page.goto("/incidents");
    await expect(page.getByRole("table", { name: "Incidents" }).getByRole("link", { name: new RegExp(MARK) })).toBeVisible();
  });

  test("an incident shows where every guard was when it happened", async ({ page }) => {
    await login(page);
    await page.goto(`/incidents/${SEEDED.fightResolved}`);
    await expect(page.getByRole("heading", { name: /Fight between two loaders/ })).toBeVisible();

    // The map renders, and the positions table is populated from the RPC.
    await expect(page.getByTestId("map")).toBeVisible({ timeout: 20_000 });
    const positions = page.getByRole("table", { name: "Guard positions" });
    await expect(positions).toBeVisible();
    const rows = positions.locator("tbody tr");
    await expect.poll(async () => rows.count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // Each row says how far off in time the fix was, so a stale pin is never passed off as fact.
    await expect(rows.first()).toContainText(/ago|before|after|min|h|Unknown|No fix/i);
  });

  test("an incident can be taken up and resolved, and the note is kept", async ({ page }) => {
    const db = admin();
    const title = `${MARK} — fire alarm in the lobby`;
    const { data: made, error } = await db
      .from("incidents")
      .insert({
        agency_id: SEED.agencyId,
        site_id: SEED.sites.prestige,
        type: "fire",
        severity: "high",
        title,
        description: "The lobby smoke detector went off; no fire found.",
        occurred_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
        reported_by: "b0000000-0000-4000-8000-000000000001",
        status: "open",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    await login(page);
    await page.goto(`/incidents/${made!.id}`);

    await page.getByRole("button", { name: "Take it up" }).click();
    await expect(async () => {
      const { data } = await db.from("incidents").select("status").eq("id", made!.id).single();
      expect(data!.status).toBe("investigating");
    }).toPass({ timeout: 15_000 });

    await page.getByRole("button", { name: "Resolve" }).click();
    const note = "Facilities confirmed a faulty detector and replaced it. Client informed.";
    await page.getByLabel("How was it resolved?").fill(note);
    await page.getByRole("button", { name: "Resolve" }).click();

    await expect(async () => {
      const { data } = await db.from("incidents").select("status,resolution,resolved_at,resolved_by").eq("id", made!.id).single();
      expect(data!.status).toBe("resolved");
      expect(data!.resolution).toContain("faulty detector");
      // The trigger stamps who closed it and when, rather than trusting the form.
      expect(data!.resolved_at).not.toBeNull();
      expect(data!.resolved_by).not.toBeNull();
    }).toPass({ timeout: 15_000 });
  });

  test("a site-scoped supervisor sees only their own sites' incidents", async ({ page }) => {
    await login(page, SEED.supervisor); // Priya covers Prestige and Brigade, not Metro.
    await page.goto("/incidents");

    const table = page.getByRole("table", { name: "Incidents" });
    await expect(table.getByRole("link", { name: /Two laptops taken/ })).toBeVisible();
    await expect(table.getByRole("link", { name: /Four men entered/ })).toBeVisible();
    // Metro is outside her scope.
    await expect(table.getByRole("link", { name: /Fight between two loaders/ })).toHaveCount(0);

    // And the row itself is unreachable by id, not merely hidden from the list.
    await page.goto(`/incidents/${SEEDED.fightResolved}`);
    await expect(page.getByRole("heading", { name: /Fight between two loaders/ })).toHaveCount(0);
  });

  // A one-line description is thousands of pixels wide as one unbreakable string, and
  // `truncate` (white-space: nowrap) hands that width straight to the column, so an
  // auto-layout table grows to fit it and the whole page scrolls sideways. Caught only
  // by measuring, because every locator still resolves on an 3000px-wide page.
  for (const width of [1280, 1440]) {
    test(`the list has no horizontal scroll at ${width}px`, async ({ page }) => {
      await login(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/incidents");
      await expect(page.getByRole("table", { name: "Incidents" })).toBeVisible();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `document is ${scrollWidth}px wide in a ${clientWidth}px viewport`).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  test("a second tenant sees none of this tenant's incidents", async ({ page }) => {
    await login(page, SEED.falconOwner);
    await page.goto("/incidents");
    await expect(page.getByText(/Two laptops taken|Four men entered|Fight between two loaders/)).toHaveCount(0);
  });
});
