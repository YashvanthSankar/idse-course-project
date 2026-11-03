import { expect, test } from "@playwright/test";

// /model: TAREEKH, the course pipeline project's model, served next to the game. Needs the real
// backend (API_URL) because it scores with the exported scikit-learn model.

test("try the model: an example, a comparison and a real past case", async ({ page }) => {
  await page.goto("/model");
  await expect(page.getByRole("heading", { name: "Will a case be disposed of within a year?" })).toBeVisible();
  // the game's mood effects are off on this separate site
  await expect(page.locator("[data-fx=grain]")).toHaveCount(0);

  await page.getByRole("button", { name: "Accident compensation claim · Madurai" }).click();
  await expect(page.getByTestId("model-district")).toHaveValue("Madurai");
  const probability = page.getByTestId("model-probability");
  await expect(probability).toHaveText(/^\d{1,3}%$/);
  await expect(page.getByText("What moved the estimate")).toBeVisible();
  await expect(page.getByText(/Still open after N months/)).toBeVisible();

  await page.getByTestId("model-compare").selectOption("Chennai");
  await expect(page.getByTestId("model-compare-result")).toContainText("Same case in Chennai");

  await page.getByTestId("model-sample").click();
  const sample = page.getByTestId("model-sample-result");
  await expect(sample).toContainText("The model said");
  await expect(sample).toContainText(/model's lean was (right|wrong)/);
  await expect(sample).toContainText("right on");
  await expect(page.getByText("not legal advice").first()).toBeVisible();
});

test("analytics and about pages render the pipeline's numbers", async ({ page }) => {
  await page.goto("/model/analytics");
  await expect(page.getByRole("heading", { name: "What 81 million court cases show" })).toBeVisible();
  await expect(page.getByText("80.9 M")).toBeVisible();
  await expect(page.getByText(/When the data was collected/)).toBeVisible();
  await expect(page.getByText("Is a predicted 70% really 70%?")).toBeVisible();
  // every chart has a table view
  await page.getByText("Show the numbers").first().click();
  await expect(page.getByRole("cell", { name: "2016-01" })).toBeVisible();

  await page.getByRole("link", { name: "About the model" }).click();
  await expect(page).toHaveURL(/\/model\/about$/);
  await expect(page.getByText(/AUC 0\.8\d\d/)).toBeVisible();
  await expect(page.getByText("ODbL v1.0").first()).toBeVisible();
});

test("the title screen links to the model", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /REAL DATA: COURT CASES/ }).click();
  await expect(page).toHaveURL(/\/model$/);
});
