import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

function futureDate(daysAhead: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Removes anything an earlier run left for Harish. */
async function clearHarishLeave() {
  const db = admin();
  await db.from("leave_requests").delete().eq("guard_id", SEED.guards.harish);
  await db.from("leave_balances").update({ casual_used: 0, earned_used: 0, unpaid_used: 0 }).eq("guard_id", SEED.guards.harish);
}

test.describe("leave", () => {
  test.beforeEach(clearHarishLeave);
  test.afterEach(clearHarishLeave);

  test("inbox lists the pending requests with balance and cover context", async ({ page }) => {
    await login(page);
    await page.goto("/leave");
    await expect(page.getByRole("heading", { name: "Leave", level: 1 })).toBeVisible();
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
    await expect(page.getByText(/of 12 casual left/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" }).first()).toBeVisible();
  });

  test("approving leave marks the rostered shift on leave and spends the balance (LEAVE-1)", async ({ page }) => {
    const db = admin();
    const day = futureDate(9);

    // A request, and a shift the guard would otherwise have worked.
    const { data: request } = await db
      .from("leave_requests")
      .insert({
        agency_id: SEED.agencyId,
        guard_id: SEED.guards.harish,
        site_id: SEED.sites.sobha,
        type: "casual",
        start_date: day,
        end_date: day,
        reason: "E2E: family function",
        status: "pending",
      })
      .select("id")
      .single();
    const { data: shift } = await db
      .from("shifts")
      .insert({
        agency_id: SEED.agencyId,
        site_id: SEED.sites.sobha,
        guard_id: SEED.guards.harish,
        shift_date: day,
        scheduled_start: `${day}T00:30:00Z`,
        scheduled_end: `${day}T08:30:00Z`,
        status: "scheduled",
      })
      .select("id")
      .single();

    try {
      await login(page);
      await page.goto("/leave");
      const card = page.getByText("E2E: family function").locator("xpath=ancestor::li[1]");
      await card.getByRole("button", { name: "Approve" }).click();
      await page.getByRole("button", { name: /^Approve/ }).last().click();

      await expect(page.getByText("E2E: family function")).toHaveCount(0, { timeout: 15_000 });

      const { data: decided } = await db.from("leave_requests").select("status,decided_by").eq("id", request!.id).single();
      expect(decided!.status).toBe("approved");

      const { data: rosterDay } = await db.from("shifts").select("status,attendance").eq("id", shift!.id).single();
      expect(rosterDay).toMatchObject({ status: "cancelled", attendance: "on_leave" });

      const { data: balance } = await db
        .from("leave_balances")
        .select("casual_used")
        .eq("guard_id", SEED.guards.harish)
        .eq("year", new Date(day).getFullYear())
        .maybeSingle();
      expect(balance!.casual_used).toBe(1);
    } finally {
      await db.from("shifts").delete().eq("id", shift!.id);
    }
  });

  test("declining records the note in history", async ({ page }) => {
    const db = admin();
    const day = futureDate(11);
    await db.from("leave_requests").insert({
      agency_id: SEED.agencyId,
      guard_id: SEED.guards.harish,
      site_id: SEED.sites.sobha,
      type: "unpaid",
      start_date: day,
      end_date: day,
      reason: "E2E: personal work",
      status: "pending",
    });

    await login(page);
    await page.goto("/leave");
    const card = page.getByText("E2E: personal work").locator("xpath=ancestor::li[1]");
    await card.getByRole("button", { name: /Decline/ }).click();
    await page.getByLabel(/note|reason/i).first().fill("Site is short-staffed that week.");
    await page.getByRole("button", { name: /^Decline/ }).last().click();

    await expect(page.getByText("E2E: personal work")).toHaveCount(0, { timeout: 15_000 });

    const { data } = await db.from("leave_requests").select("status,decision_note").eq("reason", "E2E: personal work").single();
    expect(data!.status).toBe("declined");
    expect(data!.decision_note).toContain("short-staffed");

    await page.goto("/leave?tab=history");
    await expect(page.getByText("Declined").first()).toBeVisible();
  });

  test("the calendar marks approved leave on the day", async ({ page }) => {
    const db = admin();
    const day = futureDate(6);
    await db.from("leave_requests").insert({
      agency_id: SEED.agencyId,
      guard_id: SEED.guards.harish,
      site_id: SEED.sites.sobha,
      type: "earned",
      start_date: day,
      end_date: day,
      reason: "E2E: calendar check",
      status: "approved",
      decided_at: new Date().toISOString(),
    });

    await login(page);
    await page.goto(`/leave/calendar?site=${SEED.sites.sobha}&m=${day.slice(0, 7)}`);
    await expect(page.getByText(/Sobha Dream Acres/).first()).toBeVisible();
    await expect(page.getByText(String(Number(day.slice(8, 10))), { exact: true }).first()).toBeVisible();
  });

  test("supervisor sees only their sites' requests", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/leave");
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
    await expect(page.getByText("Shivakumar M")).toHaveCount(0);
  });
});
