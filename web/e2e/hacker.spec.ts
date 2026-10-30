import { expect, test } from "@playwright/test";

// Review Focus 4: real Pyodide (downloads from the CDN on first run) against the real backend.
test("hacker mode runs pandas and survives an endless loop", async ({ page, request }) => {
  test.setTimeout(240_000);
  const meta = await (await request.post(`${process.env.API_URL ?? "http://localhost:8000"}/api/cases`, { data: { level: 1, seed: 3 } })).json();
  await page.goto(`/case/${meta.case_id}`);
  await page.getByRole("button", { name: /Hacker Mode/ }).click();
  const run = page.getByRole("button", { name: /Run · 1 coin/ });
  await expect(run).toBeEnabled({ timeout: 180_000 });

  await page.getByLabel("Python code").fill("print(df.shape)");
  await run.click();
  await expect(page.getByText(/\(\d+, 9\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("4/5")).toBeVisible();

  await page.getByLabel("Python code").fill("while True: pass");
  await run.click();
  await expect(page.getByText(/Timed out after 5 s/)).toBeVisible({ timeout: 9_000 });
  await page.getByRole("button", { name: /Close/ }).click();
  await expect(page.getByRole("button", { name: /Case Summary/ })).toBeEnabled();
});
