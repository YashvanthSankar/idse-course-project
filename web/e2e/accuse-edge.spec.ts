import { expect, test, type Page } from "@playwright/test";
import { runTool } from "./fixtures/tools";

// Edge cases of the accusation, against the REAL backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";

async function hold(page: Page) {
  const box = (await page.getByTestId("hold-to-accuse").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1900);
  await page.mouse.up();
}

test("four clues on one suspect: the accuse button still appears and you pick 2", async ({ page, request }) => {
  test.setTimeout(120_000);
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 11 } })).json();
  const truth = await (await request.get(`${API}/api/debug/cases/${meta.case_id}/truth`)).json();
  await page.goto(`/case/${meta.case_id}`);
  for (const tool of ["Case Summary", "Pattern Matrix", "Z-Score Scan", "Box & Whisker"]) {
    await runTool(page, tool);
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }
  await expect(page.getByTestId("evidence-count")).toHaveText("4 pinned · you'll file 2");

  await page.keyboard.press("b");
  await expect(page.getByTestId("corkboard")).toBeVisible();
  await page.waitForTimeout(600);
  const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${truth.fraudster_id}]`);
  for (const i of [0, 1, 2, 3]) {
    await page.getByTestId("board-evidence").nth(i).click();
    await suspect.click();
  }
  const accuse = page.getByRole("button", { name: /MAKE THE ACCUSATION/ });
  await expect(accuse).toBeVisible();
  await expect(accuse).toContainText("pick 2 of 4");
  await accuse.click();

  const exhibits = page.getByTestId("exhibits").getByRole("button");
  await expect(exhibits).toHaveCount(4);
  await expect(page.getByText("2 of 2 chosen")).toBeVisible();
  await expect(page.getByTestId("exhibits")).toContainText("Doesn't point at"); // the summary clue
  // the sharpest clues (z-score + box plot) are pre-selected
  await expect(exhibits.filter({ hasText: "Z-Score Scan" })).toHaveAttribute("aria-pressed", "true");
  await expect(exhibits.filter({ hasText: "Box & Whisker" })).toHaveAttribute("aria-pressed", "true");

  // everything fits on a 720px-tall laptop screen: no scrolling to find the button
  await page.waitForTimeout(800);
  const box = (await page.getByTestId("hold-to-accuse").boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(720);
  await hold(page);
  await expect(page.getByTestId("verdict-stamp")).toHaveText("GUILTY", { timeout: 15_000 });
  await expect(page.getByTestId("evidence-grade")).toHaveCount(2);
});

test("budget spent with no clues: you can still accuse", async ({ page, request }) => {
  test.setTimeout(90_000);
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 12 } })).json();
  for (let i = 0; i < 8; i++) await request.post(`${API}/api/cases/${meta.case_id}/hacker-charge`);
  await page.goto(`/case/${meta.case_id}`);
  await expect(page.getByTestId("case-title")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByTestId("broke-notice")).toContainText("no clues");
  const buttons = page.getByRole("button", { name: /accusation against/i });
  await expect(buttons).toHaveCount(5);
  await buttons.first().click();
  await expect(page.getByText(/No clues to file/)).toBeVisible();
  await hold(page);
  await expect(page.getByTestId("verdict-stamp")).toBeVisible({ timeout: 15_000 });
});
