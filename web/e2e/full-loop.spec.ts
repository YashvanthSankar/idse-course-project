import { expect, test, type Locator, type Page } from "@playwright/test";

// Runs against the REAL Python backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("solve case 1 end to end: tools → board → spotlight → GUILTY → case 2 unlocked", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("auditor.progress.v1");
    } catch {}
  });
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1 } })).json();
  const truth = await (await request.get(`${API}/api/debug/cases/${meta.case_id}/truth`)).json();

  await page.goto(`/case/${meta.case_id}`);
  await expect(page.getByTestId("case-title")).toHaveText("The Midnight Invoice");
  for (const tool of ["Z-Score Scan", "Box & Whisker"]) {
    await page.getByRole("button", { name: `Run ${tool}` }).click();
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }

  await page.keyboard.press("b");
  await expect(page.getByTestId("corkboard")).toBeVisible();
  await page.waitForTimeout(600);
  const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${truth.fraudster_id}]`);
  for (const i of [0, 1]) await drag(page, page.getByTestId("board-evidence").nth(i), suspect);
  await expect(page.locator("g[data-string]")).toHaveCount(2);

  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  await expect(page.getByTestId("spotlight")).toBeVisible();
  const hold = page.getByTestId("hold-to-accuse");
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1900);
  await page.mouse.up();

  await expect(page).toHaveURL(new RegExp(`/case/${meta.case_id}/verdict`), { timeout: 15_000 });
  await expect(page.getByTestId("verdict-stamp")).toHaveText("GUILTY", { timeout: 10_000 });
  const score = page.getByTestId("final-score");
  await expect(score).toHaveAttribute("data-done", "true", { timeout: 15_000 });
  expect(Number((await score.innerText()).replace(/[^\d]/g, ""))).toBeGreaterThan(1000);
  await expect(page.getByTestId("evidence-grade")).toHaveCount(2);
  await expect(page.getByTestId("reveal")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("reveal-replay")).toBeVisible();

  await page.getByTestId("next-case").click();
  await expect(page).toHaveURL(/\/office/);
  await expect(page.getByTestId("case-folder").nth(1)).not.toHaveAttribute("data-locked", "true", { timeout: 10_000 });
});

test("letting go early cancels the accusation", async ({ page, request }) => {
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1 } })).json();
  await page.goto(`/case/${meta.case_id}`);
  for (const tool of ["Z-Score Scan", "Box & Whisker"]) {
    await page.getByRole("button", { name: `Run ${tool}` }).click();
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }
  await page.keyboard.press("b");
  await page.waitForTimeout(600);
  const suspect = page.getByTestId("board-suspect").first();
  for (const i of [0, 1]) {
    await page.getByTestId("board-evidence").nth(i).click();
    await suspect.click();
  }
  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  const hold = page.getByTestId("hold-to-accuse");
  await hold.focus();
  await page.keyboard.down("Space");
  await page.waitForTimeout(500);
  await page.keyboard.up("Space");
  await expect(hold).toHaveAttribute("data-progress", "0.00");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("spotlight")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/case/${meta.case_id}$`));
});
