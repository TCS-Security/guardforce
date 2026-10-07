import { test, expect, type Page } from "@playwright/test";
import { login, SEED } from "./helpers";

/**
 * Gate & campus preview and the WhatsApp alert bot. The property side runs on sample data built
 * around the seeded sites and guards; nothing is written, so these tests need no cleanup and
 * assert only on state the screen itself changed.
 */
const SCREENS = [
  { path: "/campus", title: "Campus overview" },
  { path: "/visitors", title: "Visitor desk" },
  { path: "/gate-passes", title: "Gate passes" },
  { path: "/inspections", title: "Floor inspections" },
  { path: "/deployments", title: "Posts & duties" },
  { path: "/property", title: "Property setup" },
  { path: "/whatsapp", title: "WhatsApp alert bot" },
];

const site = `?site=${SEED.sites.prestige}`;

async function open(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.describe("gate & campus preview", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("every screen renders, says it is a preview, and the sidebar marks it", async ({ page }) => {
    for (const s of SCREENS) {
      await open(page, s.path, s.title);
      await expect(page.getByRole("note")).toContainText("Nothing you do on this screen is saved yet");
    }
    await expect(page.getByRole("link", { name: /Visitors/ })).toContainText("Preview");
    await expect(page.getByRole("link", { name: /^Overview$/ })).not.toContainText("Preview");
  });

  test("visitor: walk-in → host approves on WhatsApp → check in with badge → check out", async ({ page }) => {
    await open(page, `/visitors${site}`, "Visitor desk");
    await page.getByRole("button", { name: "New gate entry" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Fill sample" }).click();
    await expect(sheet.getByText(/set from the tenant record for Lumen Robotics Labs/)).toBeVisible();
    await sheet.getByRole("button", { name: "Sample photo" }).click();
    await expect(sheet.getByAltText("Captured photo with watermark")).toBeVisible();
    await sheet.getByRole("button", { name: "Save & ask host" }).click();

    // Its no-login link works for a walk-in the sample day never had.
    const href = await page.locator('a[href^="/approve/VIS-4632?"]').getAttribute("href");
    expect(href).toContain("&v=");
    const host = await page.context().browser()!.newPage();
    await host.goto(new URL(href!, page.url()).toString());
    await expect(host.getByText("Piyush Khare")).toBeVisible();
    await expect(host.getByRole("button", { name: "Approve" })).toBeVisible();
    await host.close();

    // The new walk-in is the one shown on the host's phone; the host taps Approve there.
    const phone = page.getByRole("figure", { name: "Host WhatsApp for VIS-4632" });
    await expect(phone).toContainText("Piyush Khare from Shivit Technologies");
    await phone.getByRole("button", { name: "Approve" }).click();
    await expect(phone).toContainText("has been cleared");

    await page.getByRole("tab", { name: "Register" }).click();
    const row = page.getByTestId("visitor-VIS-4632");
    await expect(row).toContainText("Approved");
    await row.getByRole("button", { name: "Check in" }).click();
    const checkIn = page.getByRole("dialog");
    await checkIn.getByLabel("Visitor badge number").fill("b-21");
    await checkIn.getByLabel("I matched the ID to the person in front of me").check();
    await checkIn.getByRole("button", { name: "Confirm check-in" }).click();
    await expect(row).toContainText("On premises");
    await expect(row.getByRole("button", { name: "Check in" })).toHaveCount(0);

    await row.getByRole("button", { name: "Check out" }).click();
    await page.getByRole("dialog").getByLabel("Exit remarks").fill("Badge B-21 returned");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm check-out" }).click();
    await expect(row).toContainText("Checked out");
  });

  test("visitor: a visitor the host denied cannot be checked in", async ({ page }) => {
    await open(page, `/visitors${site}`, "Visitor desk");
    const row = page.getByTestId("visitor-VIS-4630");
    await expect(row).toContainText("Awaiting host");
    await row.getByRole("button", { name: /^Deny / }).click();
    await expect(row).toContainText("Denied by host");
    await expect(row.getByRole("button", { name: "Check in" })).toHaveCount(0);
    await page.getByRole("tab", { name: /Watchlist/ }).click();
    await expect(page.getByRole("table", { name: "Watchlist" })).toContainText("Sneha Kulkarni");
  });

  test("visitor: the host's no-login link approves without signing in", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/approve/VIS-4631${site}`);
    await expect(page.getByRole("heading", { name: /to see you/ })).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status")).toContainText("Approved");
    await page.goto(`/approve/VIS-9999${site}`);
    await expect(page.getByText("This request has expired")).toBeVisible();
    await ctx.close();
  });

  test("inspection: each proof gates the next, and a failed check needs a photo and opens a task", async ({ page }) => {
    await open(page, `/inspections${site}`, "Floor inspections");
    await page.getByTestId("floor-2F-NWFN").getByRole("button", { name: "Start 4-step survey" }).click();
    const w = page.getByRole("dialog");
    await expect(w.getByRole("button", { name: "Next: geofence" })).toBeDisabled();
    await w.getByRole("button", { name: "Simulate scan" }).click();
    await w.getByRole("button", { name: "Next: geofence" }).click();

    await w.getByRole("button", { name: "Simulate GPS failure" }).click();
    await expect(w.getByText(/Outside — \d+ m too far/)).toBeVisible();
    await expect(w.getByRole("button", { name: "Next: live photo" })).toBeDisabled();
    await w.getByRole("button", { name: "Get my location" }).click();
    await expect(w.getByText("Inside the fence")).toBeVisible();
    await w.getByRole("button", { name: "Next: live photo" }).click();

    await w.getByRole("button", { name: "Sample photo" }).click();
    await w.getByRole("button", { name: "Next: checklist" }).click();
    await w.getByRole("button", { name: "Mark all OK" }).click();
    await w.getByRole("group", { name: "CHK-03" }).getByRole("button", { name: "Blocked" }).click();
    await expect(w.getByRole("button", { name: "Submit survey" })).toBeDisabled();
    await expect(w.getByRole("status")).toContainText("CHK-03");
    await w.getByRole("button", { name: "Add photo of the fault" }).click();
    await w.getByRole("button", { name: "Submit survey" }).click();
    await expect(w.getByRole("list", { name: "What the faults set in motion" })).toContainText("security supervisor");
    await w.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("floor-2F-NWFN")).toContainText("Awaiting sign-off");
  });

  test("gate pass: issue a work permit and open its printable slip", async ({ page }) => {
    await open(page, `/gate-passes${site}`, "Gate passes");
    await page.getByRole("button", { name: "Issue a pass" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Fill sample" }).click();
    await sheet.getByRole("button", { name: "Issue pass" }).click();
    const slip = page.getByRole("article", { name: /^Slip WP-/ });
    await expect(slip).toContainText("Pantry plumbing repair");
    await expect(slip.getByRole("img", { name: /QR code/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("table", { name: "Gate passes" })).toContainText("Pantry plumbing repair");
  });

  test("property: bulk import reports bad lines and adds the good ones", async ({ page }) => {
    await open(page, `/property${site}`, "Property setup");
    await page.getByRole("tab", { name: "Tenants" }).click();
    await page.getByRole("button", { name: "Bulk import" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Paste a sample" }).click();
    await expect(d.getByText("1 ready")).toBeVisible();
    await expect(d.getByText(/Line 3 —/)).toBeVisible();
    await d.getByRole("button", { name: "Import 1" }).click();
    await expect(page.getByRole("table", { name: "Tenants" })).toContainText("Indus Legal LLP");
  });

  test("whatsapp bot: the roll-call carries phone numbers, and a reply acknowledges the alert", async ({ page }) => {
    await open(page, "/whatsapp", "WhatsApp alert bot");
    await page.getByRole("group", { name: "Alert kinds" }).getByRole("button", { name: /Absent on duty/ }).click();
    const roll = page.getByRole("list", { name: "Bot alerts" }).getByRole("listitem").first();
    await expect(roll.getByRole("list", { name: "Absent guards" })).toContainText(/\+91 \d{5} \d{5}/);
    await roll.getByRole("button").first().click();
    const phone = page.getByRole("figure", { name: "Alert on WhatsApp" });
    await expect(phone).toContainText("have not reported");
    // The newest roll-call is still open: its reply buttons are live until someone answers.
    await expect(roll).toContainText("Read, no reply");
    await phone.getByRole("button", { name: "Arranging relief" }).click();
    await expect(roll).toContainText("Acknowledged");
    await expect(phone.getByRole("button", { name: "Arranging relief" })).toBeDisabled();
  });

  test("whatsapp bot: a guard who answers stops the ladder before the supervisor is paged", async ({ page }) => {
    await open(page, "/whatsapp", "WhatsApp alert bot");
    await page.getByRole("tab", { name: "Try a flow" }).click();
    await page.getByRole("button", { name: "Long break" }).click();
    const ladder = page.getByRole("list", { name: "Escalation ladder" });
    await expect(ladder.getByRole("listitem").first()).toContainText("Waiting");
    await page.getByRole("figure", { name: "Guard's WhatsApp" }).getByRole("button", { name: "पोस्ट पर वापस ✅" }).click();
    await page.getByRole("slider", { name: "Minutes since the event" }).fill("10");
    await expect(ladder.getByRole("listitem").nth(0)).toContainText("Answered");
    await expect(ladder.getByRole("listitem").nth(1)).toContainText("Not needed");
    await expect(page.getByRole("figure", { name: "Supervisor's WhatsApp" })).toContainText("No escalation needed");
  });
});
