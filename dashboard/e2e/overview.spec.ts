import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

/** ~1 km north-east of the Sobha fence, so the check-in lands in_progress *and* flagged. */
const OUTSIDE = { lat: 12.9420, lng: 77.7360 };

/** A guard who is on duty right now, so the "on duty"/"flagged" tiles have something to point at. */
async function checkInHarish() {
  const db = admin();
  const now = new Date();
  const { data, error } = await db
    .from("shifts")
    .insert({
      agency_id: SEED.agencyId,
      site_id: SEED.sites.sobha,
      guard_id: SEED.guards.harish,
      shift_date: agencyDate(),
      scheduled_start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: inError } = await db.rpc("check_in", {
    p_guard_id: SEED.guards.harish,
    p_site_id: SEED.sites.sobha,
    p_lat: OUTSIDE.lat,
    p_lng: OUTSIDE.lng,
    p_accuracy_m: 14,
    p_selfie_path: `${SEED.agencyId}/selfies/${data.id}/start.jpg`,
    p_captured_at: new Date(now.getTime() - 55 * 60 * 1000).toISOString(),
    p_device: { battery_pct: 84, model: "Redmi 9A", app_version: "1.0.0", is_mock: false },
    p_shift_id: data.id,
  });
  if (inError) throw inError;
  return data.id as string;
}

async function removeShift(shiftId: string) {
  const db = admin();
  await db.from("location_pings").delete().eq("shift_id", shiftId);
  await db.from("notifications").delete().in("event_id", ((await db.from("events").select("id").eq("shift_id", shiftId)).data ?? []).map((e) => e.id));
  await db.from("events").delete().eq("shift_id", shiftId);
  await db.from("patrols").delete().eq("shift_id", shiftId);
  await db.from("shifts").delete().eq("id", shiftId);
}

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

  // Founder feedback: "14 alerts need attention is a redundant alert. Remove this." —
  // the live alerts panel on the same screen already carries that count.
  test("the header greeting does not repeat the alert count", async ({ page }) => {
    await login(page);
    const description = page.locator("h1 + p");
    await expect(description).toHaveText(/guards? on duty across \d+ sites?\.$|No guards are on duty right now\./);
    await expect(description).not.toHaveText(/alert/i);
  });

  test("the live map is the page's primary call to action", async ({ page }) => {
    await login(page);
    // ButtonLink renders a Next Link through Base UI's Button, so the role is "button".
    const cta = page.getByRole("button", { name: "Open live map" });
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(36);
    await cta.click();
    await expect(page).toHaveURL(/\/live$/);
  });

  test("the staffing tally explains its letters", async ({ page }) => {
    await login(page);
    await expect(page.getByText("P = present")).toBeVisible();
    await expect(page.getByText("H = half day")).toBeVisible();
    await expect(page.getByText("A = absent")).toBeVisible();
    await expect(page.getByText("L = on leave")).toBeVisible();
  });

  // Founder feedback: every box under the greeting must open the guards behind the number.
  test("every number tile links to the rows behind it", async ({ page }) => {
    await login(page);
    const today = agencyDate();
    const links: [string, string][] = [
      ["See the guards who are on duty now", `/attendance?date=${today}&status=on_duty`],
      ["See the guards marked present today", `/attendance?date=${today}&status=worked`],
      ["See the guards who did not turn up", `/attendance?date=${today}&status=absent`],
      ["See the check-ins we could not verify", `/attendance?date=${today}&trust=any_flag`],
      ["See today's patrol rounds", `/patrols?date=${today}`],
    ];
    for (const [name, href] of links) {
      await expect(page.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    await expect(page.getByRole("link", { name: /Open the leave inbox|See the guards with incomplete KYC/ }))
      .toHaveAttribute("href", /^\/leave$|^\/guards\?kyc=incomplete$/);
  });

  test("the on-duty and flagged tiles land on the guards they counted", async ({ page }) => {
    const shiftId = await checkInHarish();
    try {
      await login(page);
      const table = page.getByRole("table", { name: "Attendance" });

      await page.getByRole("link", { name: "See the guards who are on duty now" }).click();
      await expect(page).toHaveURL(/status=on_duty/);
      // Only the in-progress shift survives the server-side filter: the seeded rows for
      // today have not started, so their guards must be gone from the table.
      await expect(table.getByRole("link", { name: "Harish Chandra" })).toBeVisible();
      await expect(table.getByText("Ramesh Yadav")).toHaveCount(0);

      await page.goBack();
      await page.getByRole("link", { name: "See the check-ins we could not verify" }).click();
      await expect(page).toHaveURL(/trust=any_flag/);
      await expect(table.getByRole("link", { name: "Harish Chandra" })).toBeVisible();
      await expect(table.getByText("Ramesh Yadav")).toHaveCount(0);
    } finally {
      await removeShift(shiftId);
    }
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


  // "In the Attendance, last 14 days bar graph, the bar should be clickable to show who
  // all missed attendance and who all were present."
  test("a bar in the attendance trend opens that day's guards", async ({ page }) => {
    const db = admin();
    const day = agencyDate(-1);

    // Yesterday has seeded shifts; find one and read its status straight from the database,
    // so the assertion is about the same row the chart counted.
    const { data: shifts } = await db
      .from("shifts")
      .select("id,attendance,guards(full_name)")
      .eq("shift_date", day)
      .eq("agency_id", SEED.agencyId)
      .in("attendance", ["present", "absent"])
      .limit(1);
    expect(shifts!.length, `a seeded shift on ${day}`).toBeGreaterThan(0);
    const shift = shifts![0]!;

    await login(page);

    // The link behind the segment points where it should...
    const segment = page.getByTestId(`trend-${shift.attendance}-${day}`);
    await expect(segment).toHaveAttribute("href", `/attendance?date=${day}&status=${shift.attendance}`);

    // ...and clicking the drawn bar itself does the same thing. Find the column by its
    // position in the chart's day list, then click that series' rectangle.
    const days = await page.locator('[data-testid^="trend-day-"]').evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-testid")!.replace("trend-day-", "")),
    );
    const column = days.indexOf(day);
    expect(column, `${day} is in the chart`).toBeGreaterThanOrEqual(0);
    const series = ["present", "half_day", "absent", "on_leave"].indexOf(shift.attendance!);
    await page.locator(".recharts-bar").nth(series).locator(".recharts-rectangle").nth(column).click();

    await expect(page).toHaveURL(new RegExp(`/attendance\\?date=${day}&status=${shift.attendance}`));
    const table = page.getByRole("table", { name: "Attendance" });
    await expect(table.locator(`a[href="/attendance/${shift.id}"]`)).toBeVisible();
  });
});
