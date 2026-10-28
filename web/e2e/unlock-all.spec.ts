import { expect, test } from "@playwright/test";

test("Settings → Unlock all cases opens every folder on the desk", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem("cleared")) return; // only on the first load, not the reload
      localStorage.removeItem("auditor.progress.v1");
      localStorage.removeItem("auditor.settings.v1");
      sessionStorage.setItem("cleared", "1");
    } catch {}
  });
  await page.goto("/office");
  const folders = page.getByTestId("case-folder");
  await expect(folders).toHaveCount(7);
  await expect(folders.nth(5)).toHaveAttribute("data-locked", "true");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: /Unlock all cases/ }).click();
  await page.getByRole("button", { name: "DONE" }).click();

  for (let i = 0; i < 7; i++) await expect(folders.nth(i)).not.toHaveAttribute("data-locked", "true");
  await page.reload();
  await expect(folders.nth(6)).not.toHaveAttribute("data-locked", "true");
});
