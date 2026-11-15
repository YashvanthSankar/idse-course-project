import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("a first visit opens the site guide once; it closes and can be reopened", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByRole("dialog", { name: "What's on this site" });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("link", { name: "otlr.vercel.app/model/explore" })).toHaveAttribute("href", "/model/explore");
  await expect(guide.getByRole("link", { name: "Report (PDF)" })).toHaveAttribute("href", /Court-Case-Duration-Report\.pdf$/);
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(guide).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "What's on this site" }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);

  await page.goto("/model");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "What's on this site" }).click();
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Got it" }).click();
  await expect(guide).toHaveCount(0);
});
