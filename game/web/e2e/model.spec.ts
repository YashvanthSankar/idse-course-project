import { expect, test } from "@playwright/test";

// /model: the course pipeline project's model, served next to the game. Needs the real
// backend (API_URL) because it scores with the exported scikit-learn model.

test("test the model: choose options, press Analyze, read the full result", async ({ page }) => {
  await page.goto("/model");
  await expect(page.getByRole("heading", { name: "Which court cases get stuck?" })).toBeVisible();
  await expect(page.getByText(/Logistic regression that predicts/)).toBeVisible();
  await page.getByRole("link", { name: /^Test the model/ }).first().click();
  await expect(page).toHaveURL(/\/model\/explore$/);
  await expect(page.getByRole("heading", { name: "Will this case finish within a year?" })).toBeVisible();
  // the game's mood effects are off on this separate site
  await expect(page.locator("[data-fx=grain]")).toHaveCount(0);

  // nothing runs until Analyze is pressed
  await page.getByTestId("model-topic").selectOption("accident");
  await page.getByTestId("model-district").selectOption("Madurai");
  await page.getByTestId("model-month").selectOption("3");
  await expect(page.getByTestId("model-answer")).toHaveCount(0);
  await page.getByTestId("model-analyze").click();

  const answer = page.getByTestId("model-answer");
  await expect(answer).toContainText("Road accident compensation");
  await expect(answer).toContainText("Madurai");
  await expect(page.getByTestId("model-verdict")).toHaveText(/(Likely|Not likely) to finish within 1 year/);
  await expect(page.getByTestId("model-probability")).toHaveText(/^\d{1,3}%$/);
  await expect(page.getByTestId("model-reasons").locator("li")).toHaveCount(6);
  await expect(page.getByTestId("model-inputs").locator("tbody tr")).toHaveCount(12);
  await expect(page.getByTestId("model-inputs")).toContainText("March");
  await expect(page.getByTestId("model-trust")).toContainText("Always guessing the commonest answer");
  await expect(answer).toContainText("Logistic regression");
  await expect(answer).toContainText("8,50,701");

  // changing an option marks the result as out of date until Analyze is pressed again
  await page.getByTestId("model-district").selectOption("Chennai");
  await expect(page.getByText("Press Analyze to update")).toBeVisible();
  await page.getByTestId("model-analyze").click();
  await expect(answer).toContainText("Chennai");
  await expect(page.getByText("Press Analyze to update")).toHaveCount(0);

  await page.getByTestId("model-sample").click();
  const sample = page.getByTestId("model-sample-result");
  await expect(sample).toContainText("The model predicted");
  await expect(sample).toContainText(/The model was (right|wrong)/);
  await expect(page.getByText("not legal advice").first()).toBeVisible();
});

test("what the data shows, and how it works", async ({ page }) => {
  await page.goto("/model/analytics");
  await expect(page.getByRole("heading", { name: "What 81 million court cases show" })).toBeVisible();
  await expect(page.getByText("1. What the case is about changes everything")).toBeVisible();
  // every chart has a table view
  await page.getByText("Show the numbers").first().click();
  await expect(page.getByRole("cell", { name: /Bail/ })).toBeVisible();

  // long lists fold, and the district list can be searched
  const districtChart = page.locator("figure").filter({ hasText: "6. Where the case is filed matters too" });
  await districtChart.getByRole("button", { name: /Show all 3\d districts/ }).click();
  await expect(districtChart.getByRole("button", { name: "Show fewer" })).toBeVisible();
  await districtChart.getByPlaceholder(/Find a district/).fill("Madurai");
  await expect(districtChart.locator("li")).toHaveCount(1);
  await districtChart.getByPlaceholder(/Find a district/).fill("");
  await districtChart.getByRole("button", { name: "Highest first" }).click();
  await expect(districtChart.getByRole("button", { name: "Lowest first" })).toBeVisible();

  const endings = page.locator("figure").filter({ hasText: "5. How disputes end" });
  await expect(endings.getByText(/Inside magistrate trials/)).toContainText("9.9%");

  await page.goto("/model/about");
  await expect(page).toHaveURL(/\/model\/pipeline$/);
});

test("the title screen links to the model", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /REAL DATA: COURT CASES/ }).click();
  await expect(page).toHaveURL(/\/model$/);
});


