import { expect, test, type Page } from "@playwright/test";

const LEVELS = [
  { level: 1, title: "The Midnight Invoice", teaser: "One bill too big.", budget: 8, difficulty: 1 },
  { level: 2, title: "Déjà Vu", teaser: "Haven't we paid this before?", budget: 8, difficulty: 1 },
  { level: 3, title: "Too Random To Be True", teaser: "The digits feel wrong.", budget: 10, difficulty: 2 },
  { level: 4, title: "Weekend Warrior", teaser: "Who works Sundays?", budget: 10, difficulty: 3 },
  { level: 5, title: "The Margin Call", teaser: "Expenses outgrow the deals.", budget: 12, difficulty: 4 },
  { level: 6, title: "Ghost Vendor", teaser: "A supplier nobody has met.", budget: 14, difficulty: 5 },
  { level: 7, title: "Endless", teaser: "The fraudster learns.", budget: 14, difficulty: 5 },
];

const SUSPECTS = ["Priya Nair", "Arjun Mehta", "Meera Iyer", "Kabir Shah", "Rohan Kapoor"].map(
  (name, i) => ({
    id: `E${i + 1}`,
    name,
    role: i === 4 ? "CEO" : "Sales Manager",
    department: "Sales",
    bio: "Never misses a client dinner.",
    portrait: `p${i + 3}`,
  }),
);

const META = {
  case_id: "abc123",
  level: 1,
  title: "The Midnight Invoice",
  briefing: "Rookie. Somebody filed an invoice that made accounting choke on their chai. Find it.",
  budget: 8,
  budget_left: 8,
  suspects: SUSPECTS,
  columns: ["txn_id", "date", "amount"],
  n_rows: 1000,
  unlocked_tools: ["summary", "groupby", "zscore", "iqr_box"],
};

async function mockApi(page: Page) {
  await page.route("**/api/levels", (route) => route.fulfill({ json: LEVELS }));
  await page.route("**/api/cases", (route) =>
    route.request().method() === "POST" ? route.fulfill({ json: META }) : route.fallback(),
  );
}

test("title → office → briefing → case", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const newCase = page.getByRole("button", { name: /quick case/i });
  // The title listens for a key only after hydration: keep knocking until it answers.
  await expect(async () => {
    await page.keyboard.press("Space");
    await expect(newCase).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await newCase.click();
  await expect(page).toHaveURL(/\/office$/);

  const folders = page.getByTestId("case-folder");
  await expect(folders).toHaveCount(7);
  await expect(folders.nth(0)).toHaveAttribute("data-locked", "false");
  for (let i = 1; i < 7; i++) await expect(folders.nth(i)).toHaveAttribute("data-locked", "true");

  await folders.nth(0).click();
  const briefing = page.getByRole("dialog", { name: /case briefing/i });
  await expect(briefing).toBeVisible();
  await expect(briefing.getByText("Priya Nair")).toBeVisible();
  await briefing.getByRole("button", { name: /open the files/i }).click();
  await expect(page).toHaveURL(/\/case\/abc123$/);
});

test("locked folders cannot be opened", async ({ page }) => {
  await mockApi(page);
  await page.goto("/office");
  const locked = page.getByTestId("case-folder").nth(3);
  await expect(locked).toHaveAttribute("data-locked", "true");
  await locked.click({ force: true });
  await expect(page.getByRole("dialog", { name: /case briefing/i })).toHaveCount(0);
});

test("solved levels show their best score and unlock the next", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() =>
    window.localStorage.setItem("auditor.progress.v1", JSON.stringify({ unlocked: 2, best: { 1: 1830 } })),
  );
  await page.goto("/office");
  const folders = page.getByTestId("case-folder");
  await expect(folders.nth(1)).toHaveAttribute("data-locked", "false");
  await expect(folders.nth(0).getByText("1830")).toBeVisible();
});

test("backend offline shows the closed office with retry", async ({ page }) => {
  await page.route("**/api/levels", (route) => route.abort("connectionrefused"));
  await page.goto("/office");
  await expect(page.getByText(/office is closed/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
});

test("office fits a phone screen", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/office");
  await expect(page.getByTestId("case-folder")).toHaveCount(7);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
