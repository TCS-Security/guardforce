import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

const stamp = () => Date.now().toString().slice(-6);

async function destroyTenant(agencyId: string) {
  const db = admin();
  const { data: profiles } = await db.from("profiles").select("id").eq("agency_id", agencyId);
  for (const p of profiles ?? []) {
    await db.from("profiles").delete().eq("id", p.id);
    await db.auth.admin.deleteUser(p.id);
  }
  await db.from("agencies").delete().eq("id", agencyId);
}

test.describe("platform console", () => {
  test("platform staff land on the console and tenant members cannot open it", async ({ page }) => {
    await login(page, SEED.platform);
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByText("Platform console")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sentinel Security Services" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Falcon Facility Services" })).toBeVisible();

    // A platform admin has no tenant, so the tenant dashboard sends them back here.
    await page.goto("/sites");
    await expect(page).toHaveURL(/\/platform$/);
  });

  test("a tenant owner is bounced away from the console", async ({ page }) => {
    await login(page);
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Platform console")).toHaveCount(0);
  });

  test("onboards a tenant, the owner signs in, suspension locks them out, restore lets them back", async ({ page, browser }) => {
    const db = admin();
    const name = `E2E Agency ${stamp()}`;
    const ownerEmail = `e2e-owner-${stamp()}@example.test`;

    await login(page, SEED.platform);
    await page.goto("/platform/tenants/new");
    await page.getByLabel("Agency name").fill(name);
    await page.getByLabel("City").fill("Hyderabad");
    await page.getByLabel("Guard seat cap").fill("50");
    await page.getByLabel("Name", { exact: true }).fill("E2E Owner");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByRole("button", { name: "Create tenant" }).click();

    await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]{36}/);
    const agencyId = new URL(page.url()).pathname.split("/").pop()!;
    try {
      const url = new URL(page.url());
      const password = url.searchParams.get("password")!;
      expect(password.length).toBeGreaterThan(6);
      await expect(page.getByTestId("form-status")).toContainText("Tenant created");

      // The tenant was bootstrapped with its four roles and an Owner login.
      const { data: roles } = await db.from("roles").select("system_key").eq("agency_id", agencyId);
      expect(roles!.map((r) => r.system_key).sort()).toEqual(["manager", "owner", "supervisor", "viewer"]);
      const { data: owner } = await db.from("profiles").select("role,all_sites,roles(system_key)").eq("email", ownerEmail).single();
      expect(owner!.role).toBe("owner");
      expect(owner!.all_sites).toBe(true);

      // The new owner can sign in and sees an empty agency, nothing of anyone else's.
      const ownerCtx = await browser.newContext();
      const ownerPage = await ownerCtx.newPage();
      await login(ownerPage, { email: ownerEmail, password, name: "E2E Owner" });
      await expect(ownerPage.getByRole("heading", { level: 1 })).toContainText("E2E");
      await ownerPage.goto("/guards");
      await expect(ownerPage.getByText("Ramesh Yadav")).toHaveCount(0);
      await ownerPage.goto("/settings/roles");
      await expect(ownerPage.getByRole("main").getByText("immutable")).toBeVisible();

      // Suspend from the console.
      await page.getByRole("button", { name: "Suspend tenant" }).click();
      await page.getByLabel("Reason").fill("E2E: invoice overdue");
      await page.getByRole("button", { name: "Suspend", exact: true }).click();
      await expect(page.getByText("Suspended since")).toBeVisible();

      // The owner is locked out on their next request and told why.
      await ownerPage.goto("/");
      await expect(ownerPage).toHaveURL(/\/suspended/);
      await expect(ownerPage.getByText("This account is suspended")).toBeVisible();
      await expect(ownerPage.getByText("E2E: invoice overdue")).toBeVisible();

      // Their token gets nothing from the database either.
      const { data: session } = await db.auth.signInWithPassword({ email: ownerEmail, password });
      const { createClient } = await import("@supabase/supabase-js");
      const asOwner = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
        { global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } }, auth: { persistSession: false } },
      );
      const { data: hidden } = await asOwner.from("agencies").select("id");
      expect(hidden).toEqual([]);

      // Restore.
      await page.getByRole("button", { name: "Restore access" }).click();
      await page.getByRole("button", { name: "Restore", exact: true }).click();
      await expect(page.getByText("Suspended since")).toHaveCount(0);
      await ownerPage.goto("/");
      await expect(ownerPage.getByRole("heading", { level: 1 })).toContainText("E2E");
      await ownerCtx.close();

      // Support can issue a fresh password for a locked-out owner.
      await page.getByRole("button", { name: "Reset password for E2E Owner" }).click();
      await page.getByRole("button", { name: "Issue password" }).click();
      const fresh = await page.getByLabel("One-time password").inputValue();
      expect(fresh).not.toBe(password);
      const { error: relogin } = await db.auth.signInWithPassword({ email: ownerEmail, password: fresh });
      expect(relogin).toBeNull();

      // Everything above is on the record.
      const { data: audit } = await db.from("audit_logs").select("action").eq("agency_id", agencyId).order("created_at");
      expect(audit!.map((a) => a.action)).toEqual(
        expect.arrayContaining(["tenant_created", "tenant_suspended", "tenant_active", "password_reset_by_platform"]),
      );
    } finally {
      await destroyTenant(agencyId);
    }
  });

  test("refuses a duplicate slug", async ({ page }) => {
    await login(page, SEED.platform);
    await page.goto("/platform/tenants/new");
    await page.getByLabel("Agency name").fill("Another Sentinel");
    await page.getByLabel("Slug").fill("sentinel");
    await page.getByLabel("Name", { exact: true }).fill("Someone");
    await page.getByLabel("Email").fill(`dup-${stamp()}@example.test`);
    await page.getByRole("button", { name: "Create tenant" }).click();
    await expect(page.getByTestId("form-error")).toContainText("slug is taken");
  });
});
