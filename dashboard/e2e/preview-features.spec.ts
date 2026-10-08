import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

/**
 * Preview screens run on sample data generated around the seeded guards and sites;
 * nothing they do is written, so these tests need no cleanup and only assert on
 * state the screen itself changed.
 */
const SCREENS = [
  { path: "/sos", title: "SOS alerts" },
  { path: "/alertness", title: "Alertness checks" },
  { path: "/post-orders", title: "Post orders" },
  { path: "/handover", title: "Handover register" },
  { path: "/overtime", title: "Overtime" },
  { path: "/payroll", title: /^Payroll — / },
  { path: "/cashbook", title: "Cashbook" },
  { path: "/client-reports", title: "Client daily reports" },
  { path: "/reports/distance", title: "Distance travelled" },
  { path: "/attendance/mark", title: "Mark a whole site" },
];

async function open(page: Page, path: string, title: string | RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.describe("preview screens", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("every screen renders on sample data and says so", async ({ page }) => {
    for (const s of SCREENS) {
      await open(page, s.path, s.title);
      await expect(page.getByRole("note")).toContainText("Nothing you do on this screen is saved yet");
    }
  });

  test("the sidebar marks the preview screens", async ({ page }) => {
    await page.goto("/");
    const payroll = page.getByRole("link", { name: /Payroll/ });
    await expect(payroll).toContainText("Preview");
    await expect(page.getByRole("link", { name: /^Overview$/ })).not.toContainText("Preview");
  });

  test("overtime: approving an entry takes it out of the pending list", async ({ page }) => {
    await open(page, "/overtime", "Overtime");
    const pending = page.getByRole("list", { name: "Pending overtime" }).getByRole("listitem");
    const before = await pending.count();
    expect(before).toBeGreaterThan(0);
    await page.getByRole("button", { name: /^Approve overtime for / }).first().click();
    await expect(pending).toHaveCount(before - 1);
  });

  test("payroll: the run advances a stage and a payslip opens", async ({ page }) => {
    await open(page, "/payroll", /^Payroll — /);
    const stages = page.getByRole("list", { name: "Payroll stages" });
    await expect(stages.locator("[aria-current=step]")).toContainText("Review");
    await page.getByRole("button", { name: "Approve payroll" }).click();
    await expect(stages.locator("[aria-current=step]")).toContainText("Approved");
    await page.getByRole("table", { name: "Salary register" }).getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toContainText("Net pay");
  });

  test("cashbook: a new entry lands at the top of the ledger", async ({ page }) => {
    await open(page, "/cashbook", "Cashbook");
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByLabel("Amount (₹)").fill("750");
    await page.getByLabel("Paid to / received from").fill("E2E Hardware Store");
    await page.getByRole("dialog").getByRole("button", { name: "Add entry" }).click();
    const first = page.getByRole("table", { name: "Cashbook ledger" }).locator("tbody tr").first();
    await expect(first).toContainText("E2E Hardware Store");
    await expect(first).toContainText("−750");
  });

  test("sos: owning the live alert removes the call to action", async ({ page }) => {
    await open(page, "/sos", "SOS alerts");
    const onIt = page.getByRole("button", { name: "I’m on it" });
    await expect(onIt).toHaveCount(1);
    await onIt.click();
    await expect(onIt).toHaveCount(0);
    await expect(page.getByText("Owned by Rajesh Menon")).toBeVisible();
  });

  test("post orders: publishing a revision bumps the version", async ({ page }) => {
    await open(page, "/post-orders", "Post orders");
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: /Main gate — shift duties/ }) });
    const version = Number((await section.getByText(/^v\d+$/).textContent())!.slice(1));
    await section.getByRole("button", { name: "Revise" }).click();
    await page.getByRole("button", { name: "Publish revision" }).click();
    await expect(section.getByText(`v${version + 1}`, { exact: true })).toBeVisible();
    await expect(section).toContainText(`0/`);
  });

  test("handover: a written handover appears unread at the top", async ({ page }) => {
    await open(page, "/handover", "Handover register");
    await page.getByRole("button", { name: "Write a handover" }).click();
    await page.getByLabel("Outgoing guard").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Note for the next shift").fill("E2E: side gate padlock replaced, new key in the key box");
    await page.getByRole("button", { name: "Log handover" }).click();
    const first = page.locator("li").filter({ hasText: "E2E: side gate padlock replaced" });
    await expect(first).toContainText("not read yet");
  });

  test("bulk attendance: everyone present marks every guard at the site", async ({ page }) => {
    await open(page, "/attendance/mark", "Mark a whole site");
    await expect(page.getByText(/^0\/\d+ marked$/)).toBeVisible();
    await page.getByRole("button", { name: "Everyone present" }).click();
    const marked = await page.getByText(/^\d+\/\d+ marked$/).textContent();
    const [done, total] = marked!.replace(" marked", "").split("/");
    expect(done).toBe(total);
  });

  test("attendance links to whole-site marking and reports to distance", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByRole("button", { name: "Mark a whole site" }).click();
    await expect(page).toHaveURL(/\/attendance\/mark$/);
    await page.goto("/reports");
    await page.getByRole("button", { name: "Distance travelled" }).click();
    await expect(page).toHaveURL(/\/reports\/distance$/);
  });
});
