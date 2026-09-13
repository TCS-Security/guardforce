import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

test.describe("events", () => {
  test("shows today's feed and filters by activity group", async ({ page }) => {
    const db = admin();
    // The feed is seeded relative to now, so raise one event of each group the filter must separate.
    const { data: seeded } = await db
      .from("events")
      .insert([
        { agency_id: SEED.agencyId, site_id: SEED.sites.sobha, type: "PATROL_MISSED", severity: "warn", title: "E2E patrol group probe" },
        { agency_id: SEED.agencyId, site_id: SEED.sites.sobha, type: "CHECK_IN", severity: "info", title: "E2E attendance group probe" },
      ])
      .select("id");

    try {
      await login(page);
      await page.goto(`/events?from=${agencyDate(-1)}&to=${agencyDate(0)}`);
      await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();

      const feed = page.getByTestId("event-feed");
      await expect(feed.getByText("E2E patrol group probe")).toBeVisible();
      await expect(feed.getByText("E2E attendance group probe")).toBeVisible();

      await page.goto(`/events?from=${agencyDate(-1)}&to=${agencyDate(0)}&group=patrol`);
      await expect(feed.getByText("E2E patrol group probe")).toBeVisible();
      await expect(feed.getByText("E2E attendance group probe")).toHaveCount(0);
    } finally {
      const ids = (seeded ?? []).map((e) => e.id);
      if (ids.length) {
        await db.from("notifications").delete().in("event_id", ids);
        await db.from("events").delete().in("id", ids);
      }
    }
  });

  test("filters by severity and by site", async ({ page }) => {
    await login(page);
    await page.goto(`/events?from=${agencyDate(-2)}&to=${agencyDate(0)}&severity=critical`);
    const feed = page.getByTestId("event-feed");
    await expect(feed.getByRole("listitem").first()).toBeVisible();
    await expect(feed.getByText("Check-in")).toHaveCount(0);

    await page.goto(`/events?from=${agencyDate(-2)}&to=${agencyDate(0)}&site=${SEED.sites.brigade}`);
    await expect(page.getByTestId("event-feed").getByText("Metro Cash & Carry, Yeshwanthpur")).toHaveCount(0);
  });

  test("acknowledging an alert sticks after a reload", async ({ page }) => {
    const db = admin();
    const { data: event } = await db
      .from("events")
      .insert({
        agency_id: SEED.agencyId,
        site_id: SEED.sites.sobha,
        type: "OUTAGE",
        severity: "warn",
        title: "E2E acknowledgement probe",
        payload: { body: "raised by the test suite" },
      })
      .select("id")
      .single();

    try {
      await login(page);
      await page.goto(`/events?from=${agencyDate(0)}&to=${agencyDate(0)}&ack=open`);
      await expect(page.getByText("E2E acknowledgement probe")).toBeVisible();

      await page.getByRole("button", { name: /Acknowledge \d+ shown/ }).click();
      await expect(page.getByText("E2E acknowledgement probe")).toHaveCount(0);

      const { data: after } = await db.from("events").select("acknowledged_at,acknowledged_by").eq("id", event!.id).single();
      expect(after!.acknowledged_at).not.toBeNull();

      await page.goto(`/events?from=${agencyDate(0)}&to=${agencyDate(0)}&ack=acknowledged`);
      await expect(page.getByText("E2E acknowledgement probe")).toBeVisible();
    } finally {
      await db.from("notifications").delete().eq("event_id", event!.id);
      await db.from("events").delete().eq("id", event!.id);
    }
  });

  test("exports the filtered feed as CSV", async ({ page }) => {
    await login(page);
    const res = await page.request.get(`/events/export?from=${agencyDate(-1)}&to=${agencyDate(0)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Time,Severity,Type,Title,Site,Guard");
    expect(body.split("\r\n").length).toBeGreaterThan(2);
  });

  test("supervisor sees no events from sites outside their scope", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto(`/events?from=${agencyDate(-2)}&to=${agencyDate(0)}`);
    await expect(page.getByTestId("event-feed").getByText("Metro Cash & Carry, Yeshwanthpur")).toHaveCount(0);
  });
});
