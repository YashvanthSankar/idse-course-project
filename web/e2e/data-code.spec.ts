import { expect, test } from "@playwright/test";
import { CASE_ID, FRAUDSTER, mockCase } from "./fixtures/mockCase";

test.beforeEach(async ({ page }) => {
  await mockCase(page);
  await page.goto(`/case/${CASE_ID}`);
  await page.getByRole("button", { name: "Run Z-Score Scan" }).click();
  await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 10_000 });
});

test("under the hood shows the real Python and closes on Esc", async ({ page }) => {
  await page.getByRole("button", { name: "</> Under the hood" }).click();
  const drawer = page.getByTestId("code-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("def analyze");
  await expect(page.getByTestId("code-html")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("data table loads lazily, filters and marks the implicated", async ({ page }) => {
  await page.getByRole("button", { name: "▤ Data" }).click();
  const table = page.getByTestId("data-table");
  await expect(table).toBeVisible();
  await expect(page.getByTestId("data-row").first()).toBeVisible();
  await expect(table).toContainText("loaded 200 of 1143");

  const scroller = page.getByTestId("data-scroll");
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(table).toContainText(/loaded (400|[4-9]\d\d|1143) of 1143/);

  const fraudster = await page.locator("[data-testid=suspect-card][data-flagged=true]").innerText();
  const first = fraudster.split("\n")[0].split(" ")[0];
  await table.getByRole("radio", { name: first }).click();
  await expect(table).toContainText("loaded 1143 of 1143");
  const flags = await page.locator("[data-testid=data-row]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-implicated")),
  );
  expect(flags.length).toBeGreaterThan(0);
  expect(flags.every((f) => f === "true")).toBe(true);
  expect(FRAUDSTER).toBe("E4");
  await page.keyboard.press("Escape");
  await expect(table).toBeHidden();
});
