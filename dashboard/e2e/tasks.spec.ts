import { test, expect } from "@playwright/test";
import { admin, agencyDate, login, SEED } from "./helpers";

const stamp = () => Date.now().toString().slice(-6);

async function removeTask(taskId: string) {
  const db = admin();
  await db.from("task_assignments").delete().eq("task_id", taskId);
  await db.from("tasks").delete().eq("id", taskId);
}

test.describe("tasks", () => {
  test("lists seeded tasks with their progress and due state", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");

    const table = page.getByRole("table", { name: "Tasks" });
    await expect(table.getByText("Main gate check")).toBeVisible();
    await expect(table.getByText("Shift-change briefing")).toBeVisible();
    await expect(table.getByText("Done").first()).toBeVisible();
    await expect(table.getByText("Missed").first()).toBeVisible();
  });

  test("filters by site and status", async ({ page }) => {
    await login(page);
    await page.goto(`/tasks?site=${SEED.sites.brigade}`);
    const table = page.getByRole("table", { name: "Tasks" });
    await expect(table.getByText("Visitor log check")).toBeVisible();
    await expect(table.getByText("Main gate check")).toHaveCount(0);

    await page.goto("/tasks?status=done");
    await expect(page.getByRole("table", { name: "Tasks" }).getByText("Shift-change briefing")).toBeVisible();
    await expect(page.getByRole("table", { name: "Tasks" }).getByText("Main gate check")).toHaveCount(0);
  });

  test("creates a task from a template, the guard closes it, then it is deleted", async ({ page }) => {
    const db = admin();
    await login(page);
    await page.goto("/tasks");

    await page.getByRole("button", { name: "New task" }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Sobha Dream Acres" }).click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Fire exit check" }).click();

    const title = `E2E Fire exit ${stamp()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByRole("checkbox", { name: "Harish Chandra" }).first().check();
    await page.getByRole("button", { name: "Create task" }).click();

    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);
    const taskId = new URL(page.url()).pathname.split("/").pop()!;
    try {
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      await expect(page.getByText("Assignees (0/1 done)")).toBeVisible();
      await expect(page.getByText("Required", { exact: true })).toBeVisible();

      // the guard app closes it with a photo
      await db
        .from("task_assignments")
        .update({
          status: "done",
          started_at: new Date(Date.now() - 600_000).toISOString(),
          completed_at: new Date().toISOString(),
          photo_path: `${SEED.agencyId}/tasks/${taskId}/done.jpg`,
          note: "All exits clear, panel green",
        })
        .eq("task_id", taskId);
      await db.from("tasks").update({ status: "done" }).eq("id", taskId);

      await page.reload();
      await expect(page.getByText("Assignees (1/1 done)")).toBeVisible();
      await expect(page.getByText("All exits clear, panel green")).toBeVisible();

      // and a manager can remove it
      await page.getByRole("button", { name: "Delete task" }).click();
      await page.getByRole("button", { name: "Delete task", exact: true }).last().click();
      await expect(page).toHaveURL(/\/tasks$/);

      const { data: gone } = await db.from("tasks").select("id").eq("id", taskId).maybeSingle();
      expect(gone).toBeNull();
    } finally {
      await removeTask(taskId);
    }
  });

  test("a manager can mark a task missed", async ({ page }) => {
    const db = admin();
    const { data: task } = await db
      .from("tasks")
      .insert({
        agency_id: SEED.agencyId,
        site_id: SEED.sites.sobha,
        title: `E2E Missed ${stamp()}`,
        due_at: new Date(Date.now() + 3600_000).toISOString(),
        photo_required: false,
        status: "pending",
      })
      .select("id")
      .single();
    await db.from("task_assignments").insert({ task_id: task!.id, guard_id: SEED.guards.harish, agency_id: SEED.agencyId });

    try {
      await login(page);
      await page.goto(`/tasks/${task!.id}`);
      await page.getByRole("button", { name: "Mark missed" }).click();

      // The button disappears once the task is missed, which is the signal the write landed.
      await expect(page.getByRole("button", { name: "Mark missed" })).toHaveCount(0);
      const { data: after } = await db.from("task_assignments").select("status").eq("task_id", task!.id).single();
      expect(after!.status).toBe("missed");
    } finally {
      await removeTask(task!.id);
    }
  });

  test("the day report lists evidence and exports CSV", async ({ page }) => {
    // The seeded briefing task is due relative to when the seed ran; ask for that day in IST.
    const { data: briefing } = await admin().from("tasks").select("due_at").eq("id", "10000000-0000-4000-8000-000000000002").single();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(briefing!.due_at!));
    await login(page);
    await page.goto(`/tasks/report?date=${day}`);
    await expect(page.getByRole("heading", { name: "Task report", level: 1 })).toBeVisible();
    await expect(page.getByText("Shift-change briefing")).toBeVisible();

    const res = await page.request.get(`/tasks/report/export?date=${day}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Date,Site,Task,Due,Guard,Status,Completed");
    expect(body.split("\r\n").length).toBeGreaterThan(2);
  });

  test("supervisor sees only their sites' tasks", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/tasks");
    const table = page.getByRole("table", { name: "Tasks" });
    await expect(table.getByText("Main gate check")).toBeVisible();
    await expect(table.getByText("Fire exit check")).toHaveCount(0);
  });
});
