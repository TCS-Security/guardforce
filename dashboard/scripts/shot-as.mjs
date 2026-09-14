// Screenshot pages as any seeded user: node scripts/shot-as.mjs user@x.test /route ...
import { chromium } from "@playwright/test";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const [,, email, ...paths] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + "/login");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("guardforce");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
for (const p of paths) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1800));
  const name = `${email.split("@")[0]}-${p === "/" ? "home" : p.replace(/\W+/g, "-").replace(/^-|-$/g, "")}`;
  await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: true });
  console.log("shot", name);
}
await browser.close();
