import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

const stamp = () => Date.now().toString().slice(-6);

test.describe("sites", () => {
  test("lists seeded sites with coverage and fence summary", async ({ page }) => {
    await login(page);
    await page.goto("/sites");
    await expect(page.getByRole("heading", { name: "Sites", level: 1 })).toBeVisible();

    for (const name of ["Prestige Tech Park — Gate 3", "Brigade Meadows", "Metro Cash & Carry, Yeshwanthpur", "Sobha Dream Acres"]) {
      await expect(page.getByRole("heading", { name, level: 3 })).toBeVisible();
    }
    // fence summary reflects the seeded geometry
    await expect(page.getByText("Radius 180 m · +50 m leeway")).toBeVisible();
    await expect(page.getByText(/Polygon, 4 points · \+50 m leeway/)).toBeVisible();
  });

  test("search narrows the list", async ({ page }) => {
    await login(page);
    await page.goto("/sites");
    await page.getByLabel("Search sites").fill("brigade");
    await expect(page.getByRole("heading", { name: "Brigade Meadows", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sobha Dream Acres", level: 3 })).toHaveCount(0);

    await page.getByLabel("Search sites").fill("zzzz-no-such-site");
    await expect(page.getByText("No sites match that search")).toBeVisible();
  });

  test("creates a radius site, edits its leeway, then deactivates it", async ({ page }) => {
    const name = `E2E Radius Site ${stamp()}`;
    await login(page);
    await page.goto("/sites/new");

    await page.getByLabel("Site name").fill(name);
    await page.getByLabel("Client").fill("E2E Client");
    await page.getByLabel("City").fill("Bengaluru");
    await page.getByLabel("Coordinates", { exact: true }).fill("12.99000, 77.60000");
    await page.getByRole("button", { name: "Go to coordinates" }).click();
    await page.getByLabel("Guards required").fill("3");
    await page.getByRole("button", { name: "Create site" }).click();

    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible({ timeout: 20_000 });
    const siteId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByText("3 posts unmanned")).toBeVisible();

    // stored geometry matches what the form captured
    const { data: created } = await admin().from("sites").select("lat,lng,fence_type,radius_m,leeway_m,guards_required").eq("id", siteId).single();
    expect(created).toMatchObject({ fence_type: "radius", guards_required: 3 });
    expect(created!.lat).toBeCloseTo(12.99, 3);
    expect(created!.lng).toBeCloseTo(77.6, 3);

    // edit the leeway buffer on the settings tab
    await page.goto(`/sites/${siteId}?tab=settings`);
    await page.getByLabel("Leeway buffer", { exact: true }).fill("120");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("form-status")).toContainText("Saved");
    const { data: updated } = await admin().from("sites").select("leeway_m").eq("id", siteId).single();
    expect(updated!.leeway_m).toBe(120);

    // deactivate
    await page.getByRole("button", { name: "Deactivate site" }).click();
    await expect(page.getByText("Inactive").first()).toBeVisible();
    const { data: off } = await admin().from("sites").select("is_active").eq("id", siteId).single();
    expect(off!.is_active).toBe(false);

    await admin().from("sites").delete().eq("id", siteId);
  });

  test("draws a polygon perimeter and stores it as GeoJSON", async ({ page }) => {
    const name = `E2E Polygon Site ${stamp()}`;
    await login(page);
    await page.goto("/sites/new");
    await page.getByLabel("Site name").fill(name);
    await page.getByLabel("Coordinates", { exact: true }).fill("12.95000, 77.60000");
    await page.getByRole("button", { name: "Go to coordinates" }).click();

    await page.getByRole("button", { name: "Polygon" }).click();
    const map = page.locator('[data-testid="map"] .maplibregl-canvas');
    await expect(map).toBeVisible();
    const box = (await map.boundingBox())!;
    // Three clicks make a valid ring. MapLibre occasionally swallows a click that lands while
    // the canvas is still settling, so wait for each point to register before adding the next.
    // The retry has to check first: re-clicking a point that *did* land adds a fourth vertex,
    // after which the count it is waiting for can never appear again.
    const points = [[-70, -50], [70, -50], [0, 60]];
    // Click through the canvas element rather than at raw page coordinates: Playwright then
    // checks the canvas actually receives the event, instead of firing into whatever happens
    // to be on top. The count is read back each time, so a swallowed click is retried and a
    // click that did land is not repeated — re-clicking adds a fourth vertex, after which the
    // count being waited for can never appear.
    const vertices = async () =>
      Number((await page.locator("text=/^\\d+ points?$/").first().textContent().catch(() => "0"))?.match(/\d+/)?.[0] ?? 0);
    for (const [i, [dx, dy]] of points.entries()) {
      await expect(async () => {
        if ((await vertices()) < i + 1) {
          await map.click({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
        }
        expect(await vertices()).toBe(i + 1);
      }).toPass({ timeout: 15_000 });
    }
    await expect(page.getByText("3 points", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create site" }).click();

    await expect(page.getByText(/Polygon, 3 points/)).toBeVisible({ timeout: 20_000 });
    const siteId = new URL(page.url()).pathname.split("/").pop()!;

    const { data } = await admin().from("sites").select("fence_type,polygon").eq("id", siteId).single();
    expect(data!.fence_type).toBe("polygon");
    const poly = data!.polygon as { type: string; coordinates: number[][][] };
    expect(poly.type).toBe("Polygon");
    expect(poly.coordinates[0]).toHaveLength(4); // closed ring
    expect(poly.coordinates[0][0]).toEqual(poly.coordinates[0][3]);

    await admin().from("sites").delete().eq("id", siteId);
  });

  test("rejects a polygon fence with fewer than three points", async ({ page }) => {
    await login(page);
    await page.goto("/sites/new");
    await page.getByLabel("Site name").fill(`E2E Bad Polygon ${stamp()}`);
    await page.getByRole("button", { name: "Polygon" }).click();
    const map = page.locator('[data-testid="map"] .maplibregl-canvas');
    const box = (await map.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByTestId("form-error")).toContainText("Draw the site perimeter");
    await expect(page).toHaveURL(/\/sites\/new/);
  });

  test("manages shift types and refuses to delete one in use", async ({ page }) => {
    const site = SEED.sites.prestige;
    await login(page);
    await page.goto(`/sites/${site}?tab=shifts`);

    // seeded shifts are listed with their windows
    await expect(page.getByText("06:00 – 14:00", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("overnight").first()).toBeVisible();

    // add one
    const shiftName = `E2E Relief ${stamp()}`;
    await page.getByRole("button", { name: "Add shift", exact: true }).click();
    await page.getByLabel("Name").fill(shiftName);
    await page.getByLabel("Start").fill("10:00");
    await page.getByLabel("End").fill("18:00");
    await page.getByLabel("Guards").fill("1");
    await page.getByRole("button", { name: "Save shift" }).click();
    await expect(page.getByText(shiftName)).toBeVisible();
    await expect(page.getByText("10:00 – 18:00", { exact: false })).toBeVisible();

    // edit it
    await page.getByRole("button", { name: `Edit ${shiftName}` }).click();
    await page.getByLabel("Guards").fill("4");
    await page.getByRole("button", { name: "Save shift" }).click();
    await expect(page.getByText(/10:00 – 18:00 · 8h · 4 guards/)).toBeVisible();

    // delete it
    await page.getByRole("button", { name: `Delete ${shiftName}` }).click();
    await page.getByRole("button", { name: "Delete shift" }).click();
    await expect(page.getByText(shiftName)).toHaveCount(0);

    // a seeded shift type carries roster history, so deletion is refused
    await page.getByRole("button", { name: "Delete Night" }).click();
    await page.getByRole("button", { name: "Delete shift" }).click();
    await expect(page.getByTestId("form-error")).toContainText("roster entries");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Delete Night" })).toBeVisible();
  });

  test("supervisor sees only scoped sites and cannot create one", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/sites");
    await expect(page.getByRole("heading", { name: "Prestige Tech Park — Gate 3", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Metro Cash & Carry, Yeshwanthpur", level: 3 })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New site" })).toHaveCount(0);

    await page.goto("/sites/new");
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();

    // and cannot open a site outside their scope
    await page.goto(`/sites/${SEED.sites.metro}`);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });

  test("site detail shows today's shifts and patrol routes", async ({ page }) => {
    await login(page);
    await page.goto(`/sites/${SEED.sites.prestige}`);
    await expect(page.getByText("On duty now")).toBeVisible();
    await expect(page.getByText("Perimeter round")).toBeVisible();
    await expect(page.getByText("every 120 min · 2 photos")).toBeVisible();

    await page.goto(`/sites/${SEED.sites.prestige}?tab=team`);
    await expect(page.getByText("Priya Nair")).toBeVisible();
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
  });
});
