import { expect, test, type Locator, type Page } from "@playwright/test";
import { CASE_ID, FRAUDSTER, mockCase } from "./fixtures/mockCase";

async function runAndPin(page: Page, tool: string, phone = false) {
  if (phone) await page.getByRole("button", { name: /Tools/ }).click();
  await page.getByRole("button", { name: `Run ${tool}` }).click();
  await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
}

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.describe("corkboard", () => {
  test("drag two pieces of evidence onto a suspect and the accusation unlocks", async ({ page }) => {
    await mockCase(page);
    await page.goto(`/case/${CASE_ID}`);
    await runAndPin(page, "Z-Score Scan");
    await runAndPin(page, "Box & Whisker");
    await expect(page.getByTestId("evidence-item")).toHaveCount(2);

    await page.keyboard.press("b");
    await expect(page.getByTestId("corkboard")).toBeVisible();
    const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${FRAUDSTER}]`);
    const photos = page.getByTestId("board-evidence");
    await expect(photos).toHaveCount(2);
    await page.waitForTimeout(600); // let the polaroids land

    await drag(page, photos.nth(0), suspect);
    await expect(page.locator("g[data-string]")).toHaveCount(1);
    await drag(page, photos.nth(1), suspect);
    await expect(page.locator("g[data-string]")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "MAKE THE ACCUSATION" })).toBeVisible();

    // dropping on empty cork cuts the string again
    const box = (await page.getByTestId("corkboard").boundingBox())!;
    const photo = (await photos.nth(1).boundingBox())!;
    await page.mouse.move(photo.x + 40, photo.y + 40);
    await page.mouse.down();
    await page.mouse.move(photo.x + 60, photo.y + 60, { steps: 4 });
    await page.mouse.move(box.width - 30, box.height - 30, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator("g[data-string]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "MAKE THE ACCUSATION" })).toHaveCount(0);
  });

  test("tap to link works without dragging (phones)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockCase(page);
    await page.goto(`/case/${CASE_ID}`);
    await runAndPin(page, "Z-Score Scan", true);
    await runAndPin(page, "Box & Whisker", true);
    await page.getByRole("button", { name: /Evidence/ }).click();
    await page.getByRole("button", { name: "OPEN BOARD" }).click();
    await expect(page.getByTestId("corkboard")).toBeVisible();
    await page.waitForTimeout(600);
    const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${FRAUDSTER}]`);
    for (const i of [0, 1]) {
      await page.getByTestId("board-evidence").nth(i).click();
      await expect(page.getByText("NOW TAP A SUSPECT")).toBeVisible();
      await suspect.click();
    }
    await expect(page.locator("g[data-string]")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "MAKE THE ACCUSATION" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("corkboard")).toHaveCount(0);
  });
});
