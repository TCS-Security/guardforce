import { expect, test, type Page } from "@playwright/test";
import { SEED, admin, agencyDate, login } from "./helpers";

/**
 * Sales pipeline. Every test raises its own prospects (unique source_ref per run) and removes
 * them, the leads made from them and any site a "won" lead created, so the suite re-runs
 * without a db reset.
 */

const RUN = Date.now().toString(36);
const db = admin();

// Brigade Meadows (a Sentinel site) is at 12.84590, 77.51150; this sits ~600 m away.
const NEAR_SITE = { lat: 12.8505, lng: 77.5150 };

async function raiseProspect(name: string, extra: Record<string, unknown> = {}) {
  const row = {
    source: "manual",
    source_ref: `e2e-${RUN}-${name}`,
    name,
    segment: "apartment",
    locality: "Kanakapura Road",
    city: "Bengaluru",
    ...NEAR_SITE,
    size_value: 640,
    size_unit: "flats",
    completion_on: agencyDate(-60),
    label: "hot",
    reasons: [{ kind: "handover", text: "Handed over to residents recently", source: "RERA" }],
    est_guards: 14,
    phone: "080 4000 1234",
    ...extra,
  };
  const { data, error } = await db.from("prospects").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function cleanup() {
  const { data: leads } = await db.from("leads").select("id,won_site_id").like("name", `E2E ${RUN}%`);
  const siteIds = (leads ?? []).map((l) => l.won_site_id).filter(Boolean) as string[];
  await db.from("leads").delete().like("name", `E2E ${RUN}%`);
  if (siteIds.length) await db.from("sites").delete().in("id", siteIds);
  await db.from("prospects").delete().like("source_ref", `e2e-${RUN}-%`);
}

test.afterAll(cleanup);

async function addFromFind(page: Page, name: string) {
  await page.goto(`/sales?tab=find&q=${encodeURIComponent(name)}`);
  const row = page.locator(`[data-prospect="${name}"]`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Add ${name}` }).click();
  await expect(row).toHaveCount(0);
}

async function openLead(page: Page, name: string) {
  await page.goto(`/sales?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name, exact: true }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name })).toBeVisible();
  return card;
}

test("a supervisor has no Sales page and no nav entry", async ({ page }) => {
  await login(page, SEED.supervisor);
  await expect(page.getByRole("link", { name: "Sales leads" })).toHaveCount(0);
  const res = await page.goto("/sales");
  expect(res?.status()).toBe(404);
});

test("find a new lead, add it, and see why it is Hot on the lead card", async ({ page }) => {
  const name = `E2E ${RUN} Lakeview Residency`;
  await raiseProspect(name);
  await login(page);
  await expect(page.getByRole("link", { name: "Sales leads" })).toBeVisible();

  await addFromFind(page, name);

  const card = await openLead(page, name);
  const why = card.getByRole("list", { name: "Why this lead" });
  // Worked out by the rules when the lead was added, not copied from the prospect row.
  await expect(why).toContainText("Handed over to residents around");
  await expect(why).toContainText("about 14 guards needed");
  await expect(why).toContainText("from your site at Brigade Meadows");
  await expect(card.locator("p", { hasText: "Who to ask for:" })).toContainText("Residents' association");
  // The prospect's public number arrived as the main number.
  await expect(card.locator('[data-number="080 4000 1234"]')).toBeVisible();
});

test("log a call from the card: the number is marked and the lead moves to Called", async ({ page }) => {
  const name = `E2E ${RUN} Call Gardens`;
  await raiseProspect(name);
  await login(page);
  await addFromFind(page, name);
  const card = await openLead(page, name);

  await card.getByRole("button", { name: "Add person" }).click();
  const form = card.getByRole("form", { name: "Add person" });
  await form.getByLabel("Name").fill("Ramesh Kulkarni");
  await form.getByLabel("Designation").fill("Association Secretary");
  await form.getByLabel("Mobile").fill("98450 11111");
  await form.getByRole("button", { name: "Save person" }).click();

  const person = card.locator('[data-contact="Ramesh Kulkarni"]');
  await expect(person).toContainText("Association Secretary");
  await person.locator('[data-number="98450 11111"]').getByRole("link", { name: "Call" }).click();

  const outcome = card.getByRole("form", { name: "How did the call go?" });
  await outcome.getByRole("button", { name: "Reached" }).click();
  await outcome.getByLabel("Call note").fill("Committee meets Sunday");
  await outcome.getByRole("button", { name: "Save call" }).click();

  await expect(card.getByRole("combobox", { name: "Stage" })).toContainText("Called");
  await expect(person.locator('[data-number="98450 11111"]')).toContainText("worked");
  await expect(card.getByRole("list", { name: "History" })).toContainText("Reached. Committee meets Sunday");

  const { data } = await db.from("leads").select("stage,next_follow_up").eq("name", name).single();
  expect(data?.stage).toBe("called");
  expect(data?.next_follow_up).not.toBeNull();
});

test("filling in a weak current agency turns a Warm factory Hot", async ({ page }) => {
  const name = `E2E ${RUN} Spindle Works`;
  await raiseProspect(name, { segment: "factory", size_value: null, size_unit: null, completion_on: null, label: "warm", reasons: [], est_guards: null, lat: null, lng: null });
  await login(page);
  await addFromFind(page, name);
  const card = await openLead(page, name);
  await expect(card.getByText("WARM", { exact: false }).first()).toBeVisible();

  await card.getByRole("region", { name: "Current agency" }).getByRole("button", { name: "Edit" }).click();
  const form = card.getByRole("form", { name: "Edit current agency" });
  await form.getByLabel("Agency name").fill("Shield Force Security");
  await form.getByRole("combobox", { name: "Software" }).click();
  await page.getByRole("option", { name: "No app" }).click();
  await form.getByLabel("Size", { exact: true }).fill("20");
  await form.getByRole("combobox", { name: "Size unit" }).click();
  await page.getByRole("option", { name: "guards", exact: true }).click();
  await form.getByRole("button", { name: "Save" }).click();

  await expect(card.getByRole("list", { name: "Why this lead" })).toContainText("Shield Force Security. No app seen");
  const { data } = await db.from("leads").select("label").eq("name", name).single();
  expect(data?.label).toBe("hot");
});

test("move a lead through stages from the card, and Lost asks why", async ({ page }) => {
  const name = `E2E ${RUN} Board Towers`;
  await raiseProspect(name);
  await login(page);
  await addFromFind(page, name);
  await page.goto(`/sales?view=board&q=${encodeURIComponent(name)}`);
  await expect(page.locator('section[data-stage="new"]').locator(`article[data-lead="${name}"]`)).toBeVisible();

  const card = await openLead(page, name);
  await card.getByRole("button", { name: "Mark as lost" }).click();
  await card.getByRole("group", { name: "Why was it lost?" }).getByRole("button", { name: "Kept old agency" }).click();
  await expect.poll(async () => (await db.from("leads").select("stage,lost_reason").eq("name", name).single()).data).toEqual({
    stage: "lost",
    lost_reason: "Kept old agency",
  });
});

test("a won lead becomes a GuardWatch site", async ({ page }) => {
  const name = `E2E ${RUN} Won Heights`;
  await raiseProspect(name);
  await login(page);
  await addFromFind(page, name);
  const card = await openLead(page, name);
  await card.getByRole("button", { name: "Won: make this a site" }).click();
  await page.waitForURL(/\/sites\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const { data } = await db.from("leads").select("stage,won_site_id").eq("name", name).single();
  expect(data?.stage).toBe("won");
  expect(data?.won_site_id).toBeTruthy();
});
