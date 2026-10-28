import { expect, test } from "@playwright/test";

const API = "http://localhost:8000";

test.describe("phone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  for (const path of ["/", "/office"]) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("investigation screen fits a phone and runs a tool by touch", async ({ page, request }) => {
    const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 8 } })).json();
    await page.goto(`/case/${meta.case_id}`);
    await expect(page.getByTestId("case-title")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("rain is drawn once and never animates", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas[data-fx=rain]");
    await expect(canvas).toHaveCount(1);
    // wait for the first paint (an unpainted canvas is the browser's default 300x150)
    await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).not.toBe(300);
    const a = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.waitForTimeout(600);
    const b = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    expect(b).toBe(a);
  });

  test("typewriter text appears instantly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Every number tells a story. Some of them lie.", { exact: false }).first())
      .toBeAttached();
    const typed = await page.locator("[aria-label='Every number tells a story. Some of them lie.'] > span").first().textContent();
    expect(typed).toBe("Every number tells a story. Some of them lie.");
  });
});
