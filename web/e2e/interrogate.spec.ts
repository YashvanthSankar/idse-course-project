import { expect, test } from "@playwright/test";

const API = "http://localhost:8000";

test("questioning a suspect reveals a statement and costs nothing", async ({ page, request }) => {
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 2, seed: 5 } })).json();
  await page.goto(`/case/${meta.case_id}`);
  const first = page.getByTestId("suspect-card").first();
  await first.getByTestId("question-suspect").click();
  const said = first.getByTestId("suspect-statement");
  await expect(said).toBeVisible();
  await expect.poll(async () => (await said.innerText()).length, { timeout: 8000 }).toBeGreaterThan(20);
  await expect(page.getByTestId("budget-meter")).toContainText("5/5");
});
