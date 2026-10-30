import { expect, test } from "@playwright/test";
import { runTool } from "./fixtures/tools";

const API = process.env.API_URL ?? "http://localhost:8000";

// A reload (or a locked phone) must lose nothing: results, pinned evidence, then the verdict.
test("reloading restores results, pins and the verdict", async ({ page, request }) => {
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 6 } })).json();
  const caseId = meta.case_id as string;
  await page.goto(`/case/${caseId}`);

  await runTool(page, "Z-Score Scan");
  await expect(page.getByRole("button", { name: "📌 Pin as evidence" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  await runTool(page, "Box & Whisker");
  await expect(page.getByTestId("budget-meter")).toContainText("1/5", { timeout: 15_000 });

  await page.reload();
  await expect(page.getByTestId("budget-meter")).toContainText("1/5");
  await expect(page.getByRole("button", { name: /Z-Score Scan/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Box & Whisker/ }).first()).toBeVisible();
  await expect(page.getByText("1 of 2")).toBeVisible();

  // Close the case on the server, then reload the case page: it should hand over to the verdict.
  const state = await (await request.get(`${API}/api/cases/${caseId}/state`)).json();
  const truth = await (await request.get(`${API}/api/debug/cases/${caseId}/truth`)).json();
  await request.post(`${API}/api/cases/${caseId}/accuse`, {
    data: { suspect_id: truth.fraudster_id, evidence_ids: state.results.map((r: { result_id: string }) => r.result_id) },
  });
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/case/${caseId}/verdict$`), { timeout: 15_000 });
  await expect(page.getByText("GUILTY").first()).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText("GUILTY").first()).toBeVisible({ timeout: 15_000 });
});

test("a room that doesn't exist is caught before the name form", async ({ page }) => {
  await page.goto("/play/QQQQ");
  await expect(page.getByText("No such room.")).toBeVisible();
  await expect(page.getByLabel("Your detective name")).toHaveCount(0);
  await expect(page.getByLabel("Room code")).toBeVisible();
});

test("unknown pages get the noir 404", async ({ page }) => {
  const res = await page.goto("/no/such/page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Case not found" })).toBeVisible();
});

test("a host screen opened without its token explains who owns it", async ({ page, request }) => {
  const { code } = await (await request.post(`${API}/api/rooms`)).json();
  await page.goto(`/host/${code}`);
  await expect(page.getByText("This screen belongs to another session.")).toBeVisible();
  await expect(page.getByRole("link", { name: "START A NEW CLASS SESSION" })).toBeVisible();
});
