import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * The app shell's navigation. The nav has grown past one screen, so it must scroll on its own
 * everywhere (desktop sidebar and the phone drawer), and the sidebar panel must run the full
 * height of the page however long the page is.
 */
test.describe("app shell navigation", () => {
  test("the sidebar runs the full height of a long page and its nav stays in view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto("/whatsapp");
    await page.getByRole("tab", { name: "Alert rules" }).click();
    await expect(page.getByRole("table", { name: "Alert rules" })).toBeVisible();

    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(docHeight, "the page is longer than the window").toBeGreaterThan(900);
    const aside = page.getByRole("complementary", { name: "Main navigation" });
    const box = await aside.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(docHeight - 1);

    // Scrolled to the very bottom of the page, the sidebar column is still on screen.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(aside.getByRole("link", { name: /WhatsApp bot/ })).toBeInViewport();
    await expect(aside.getByText("Agency", { exact: true })).toBeInViewport();
  });

  test("on a short window the nav scrolls and the current page is scrolled into view", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await login(page);
    await page.goto("/whatsapp");
    const nav = page.getByRole("complementary", { name: "Main navigation" });
    const current = nav.getByRole("link", { name: /WhatsApp bot/ });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toBeInViewport();
    // The agency footer stays pinned below the scrolling list.
    await expect(nav.getByText("Agency", { exact: true })).toBeInViewport();
  });

  test("on a phone the drawer scrolls to the last item", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await login(page);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    const settings = drawer.getByRole("link", { name: /^Settings$/ });
    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeInViewport();
    await settings.click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(drawer).toBeHidden();
  });
});
