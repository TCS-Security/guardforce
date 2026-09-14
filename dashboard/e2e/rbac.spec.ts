import { test, expect, type Browser } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

const stamp = () => Date.now().toString().slice(-6);

/** Creates a dashboard login on Sentinel with the given permissions and site scope. */
async function createStaff(opts: { permissions: string[]; allSites?: boolean; siteIds?: string[]; roleName?: string }) {
  const db = admin();
  const email = `e2e-${stamp()}@sentinel.test`;
  const password = "guardforce";

  const { data: role, error: roleError } = await db
    .from("roles")
    .insert({ agency_id: SEED.agencyId, name: opts.roleName ?? `E2E role ${stamp()}`, permissions: opts.permissions })
    .select("id")
    .single();
  if (roleError) throw roleError;

  const { data: user, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) throw authError;

  await db.from("profiles").insert({
    id: user.user.id,
    agency_id: SEED.agencyId,
    role: "staff",
    role_id: role.id,
    all_sites: opts.allSites ?? true,
    full_name: "E2E Staff",
    email,
  });
  if (!opts.allSites && opts.siteIds?.length) {
    await db.from("supervisor_sites").insert(opts.siteIds.map((site_id) => ({ profile_id: user.user.id, site_id, agency_id: SEED.agencyId })));
  }

  return {
    email,
    password,
    userId: user.user.id,
    roleId: role.id,
    async destroy() {
      await db.from("supervisor_sites").delete().eq("profile_id", user.user.id);
      await db.from("notification_preferences").delete().eq("profile_id", user.user.id);
      await db.from("profiles").delete().eq("id", user.user.id);
      await db.auth.admin.deleteUser(user.user.id);
      await db.from("roles").delete().eq("id", role.id);
    },
  };
}

async function loginAs(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { email, password, name: "" });
  return { context, page };
}

test.describe("tenant roles", () => {
  test("every tenant has the four built-in roles and Owner cannot be edited", async ({ page }) => {
    await login(page);
    await page.goto("/settings/roles");
    const list = page.getByRole("main").locator("section").first();
    for (const name of ["Owner", "Manager", "Supervisor", "Viewer"]) {
      await expect(list.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(list.getByText("immutable")).toBeVisible();

    await page.getByRole("button", { name: "View Owner" }).click();
    await expect(page.getByText("Owners always hold every permission")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save role" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "View Sites" })).toBeDisabled();
  });

  test("an owner creates a role from the matrix, edits it, and deletes it", async ({ page }) => {
    const db = admin();
    const name = `Client desk ${stamp()}`;
    await login(page);
    await page.goto("/settings/roles");

    await page.getByRole("button", { name: "New role" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Description").fill("Reads reports, acknowledges alerts");
    await page.getByRole("checkbox", { name: "View Reports" }).check();
    await page.getByRole("checkbox", { name: "Acknowledge Events" }).check();
    await page.getByRole("button", { name: "Create role" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(name)).toBeVisible();
    const { data: created } = await db.from("roles").select("id,permissions").eq("agency_id", SEED.agencyId).eq("name", name).single();
    // Acknowledging implies reading events; the editor keeps the pair consistent.
    expect(created!.permissions.sort()).toEqual(["events:acknowledge", "events:read", "reports:read"]);

    await page.getByRole("button", { name: `Edit ${name}` }).click();
    await page.getByRole("checkbox", { name: "View Events" }).uncheck();
    await page.getByRole("button", { name: "Save role" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const { data: edited } = await db.from("roles").select("permissions").eq("id", created!.id).single();
    expect(edited!.permissions).toEqual(["reports:read"]);

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("button", { name: "Delete role" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("the database refuses permissions outside the catalogue and edits to Owner", async () => {
    const db = admin();
    const { error } = await db.from("roles").insert({ agency_id: SEED.agencyId, name: `Bad ${stamp()}`, permissions: ["sites:read", "nuke:everything"] });
    expect(error?.message).toContain("UNKNOWN_PERMISSION");

    const { data: owner } = await db.from("roles").select("id").eq("agency_id", SEED.agencyId).eq("system_key", "owner").single();
    const { error: ownerError } = await db.from("roles").update({ permissions: ["sites:read"] }).eq("id", owner!.id);
    expect(ownerError?.message).toContain("OWNER_ROLE_IMMUTABLE");
  });
});

test.describe("permission enforcement", () => {
  test("a read-only user sees only their areas and cannot write, even through the API", async ({ browser }) => {
    const staff = await createStaff({ permissions: ["sites:read", "guards:read", "attendance:read"], allSites: true });
    try {
      const { context, page } = await loginAs(browser, staff.email, staff.password);

      // Nav is trimmed to what they may read.
      await expect(page.getByRole("link", { name: "Sites" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Roster" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

      // No write affordances on a page they can read.
      await page.goto("/sites");
      await expect(page.getByRole("link", { name: "New site" })).toHaveCount(0);
      await page.goto(`/sites/${SEED.sites.sobha}`);
      await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

      // Pages they cannot read 404 rather than leak.
      await page.goto("/roster");
      await expect(page.getByText(/404|not found/i).first()).toBeVisible();
      await page.goto("/settings");
      await expect(page.getByText(/404|not found/i).first()).toBeVisible();

      // The KYC vault is closed to them even though they can see the guard.
      await page.goto(`/guards/${SEED.guards.suresh}`);
      await expect(page.getByText("Identity documents are restricted")).toBeVisible();

      // And RLS holds regardless of the UI: a direct write with their own token is rejected.
      const db = admin();
      const { data: session } = await db.auth.signInWithPassword({ email: staff.email, password: staff.password });
      const { createClient } = await import("@supabase/supabase-js");
      const asStaff = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
        { global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } }, auth: { persistSession: false } },
      );
      const { data: rows } = await asStaff.from("sites").select("id");
      expect(rows!.length).toBeGreaterThan(0);
      const { error: writeError, data: written } = await asStaff.from("sites").update({ notes: "should not land" }).eq("id", SEED.sites.sobha).select("id");
      expect(writeError ?? null).toBeNull();
      expect(written).toEqual([]); // zero rows matched the policy
      const { data: probe } = await db.from("sites").select("notes").eq("id", SEED.sites.sobha).single();
      expect(probe!.notes).not.toBe("should not land");

      await context.close();
    } finally {
      await staff.destroy();
    }
  });

  test("site scope restricts a fully-permissioned staff member to their sites", async ({ browser }) => {
    const { data: manager } = await admin().from("roles").select("permissions").eq("agency_id", SEED.agencyId).eq("system_key", "manager").single();
    const staff = await createStaff({ permissions: manager!.permissions, allSites: false, siteIds: [SEED.sites.sobha] });
    try {
      const { context, page } = await loginAs(browser, staff.email, staff.password);
      await page.goto("/sites");
      await expect(page.getByRole("heading", { name: "Sobha Dream Acres", level: 3 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Prestige Tech Park — Gate 3", level: 3 })).toHaveCount(0);
      await page.goto(`/sites/${SEED.sites.prestige}`);
      await expect(page.getByText(/404|not found/i).first()).toBeVisible();
      await context.close();
    } finally {
      await staff.destroy();
    }
  });

  test("an owner changes a colleague's role and scope from the team page", async ({ page }) => {
    const db = admin();
    const staff = await createStaff({ permissions: ["sites:read"], allSites: true });
    try {
      await login(page);
      await page.goto("/settings/team");
      const row = page.getByRole("row", { name: new RegExp(staff.email) });
      await row.getByRole("button", { name: "Edit" }).click();

      await page.getByRole("combobox", { name: "Role" }).click();
      await page.getByRole("option", { name: "Viewer" }).click();
      await page.getByRole("switch", { name: "Every site" }).click();
      await page.getByRole("checkbox", { name: "Brigade Meadows" }).check();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(row.getByText("Viewer")).toBeVisible();
      await expect(row.getByText("Brigade Meadows")).toBeVisible();

      const { data: after } = await db.from("profiles").select("all_sites,roles(system_key)").eq("id", staff.userId).single();
      expect(after!.all_sites).toBe(false);
      expect((after!.roles as unknown as { system_key: string } | null)?.system_key).toBe("viewer");
    } finally {
      await staff.destroy();
    }
  });
});

test.describe("tenant isolation", () => {
  test("a second tenant's owner sees none of the first tenant's data", async ({ page }) => {
    await login(page, SEED.falconOwner);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Neha");
    await page.goto("/sites");
    await expect(page.getByText("No sites yet")).toBeVisible();
    await page.goto("/guards");
    await expect(page.getByText("Ramesh Yadav")).toHaveCount(0);
    await page.goto(`/sites/${SEED.sites.prestige}`);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
    await page.goto(`/guards/${SEED.guards.suresh}`);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});
