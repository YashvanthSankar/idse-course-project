import { expect, test } from "@playwright/test";

test("title screen renders with rain and grain", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("canvas[data-fx=rain]")).toHaveCount(1);
  await expect(page.locator("[data-fx=grain]")).toHaveCount(1);
});
