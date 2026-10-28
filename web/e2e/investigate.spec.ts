import { expect, test } from "@playwright/test";
import { CASE_ID, FRAUDSTER, mockCase } from "./fixtures/mockCase";
import { runTool } from "./fixtures/tools";

test.describe("investigation screen", () => {
  test("run a tool, see the chart, re-run for free, pin evidence", async ({ page }) => {
    await mockCase(page);
    await page.goto(`/case/${CASE_ID}`);
    await expect(page.getByTestId("case-title")).toHaveText("The Midnight Invoice");
    await expect(page.getByTestId("budget-meter")).toContainText("8/8");

    await runTool(page, "Z-Score Scan");
    await expect(page.getByTestId("terminal-run")).toBeVisible();
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-testid=plotly-chart] .main-svg").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("budget-meter")).toContainText("6/8");
    await expect(page.locator(`[data-testid=suspect-card][data-flagged=true]`)).toHaveCount(1);

    await runTool(page, "Z-Score Scan");
    await expect(page.getByTestId("cached-badge")).toBeVisible();
    await expect(page.getByTestId("budget-meter")).toContainText("6/8");

    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
    await expect(page.getByTestId("evidence-item")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "📌 Pinned" })).toBeDisabled();
    expect(FRAUDSTER).toBe("E4");
  });

  test("number keys run tools and locked tools stay locked", async ({ page }) => {
    await mockCase(page);
    await page.goto(`/case/${CASE_ID}`);
    await expect(page.getByTestId("tool-card").first()).toBeVisible();
    await expect(page.locator("[data-tool=duplicates]")).toHaveAttribute("data-locked", "true");
    await expect(page.locator("[data-tool=duplicates]")).toContainText("Case 2");
    await page.keyboard.press("1");
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("budget-meter")).toContainText("7/8");
  });

  test("running out of budget shakes the meter and explains", async ({ page }) => {
    await mockCase(page, { budget: 1 });
    await page.goto(`/case/${CASE_ID}`);
    await runTool(page, "Z-Score Scan");
    await expect(page.getByTestId("toast")).toContainText("Out of budget");
  });

  test("phone layout: tabs, no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockCase(page);
    await page.goto(`/case/${CASE_ID}`);
    await runTool(page, "Case Summary");
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Suspects/ }).click();
    await expect(page.getByTestId("suspect-card")).toHaveCount(5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
