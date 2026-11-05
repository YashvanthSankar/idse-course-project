import { expect, test } from "@playwright/test";

// /model: TAREEKH, the course pipeline project's model, served next to the game. Needs the real
// backend (API_URL) because it scores with the exported scikit-learn model.

test("check a case: pick what it's about and where, read a plain answer", async ({ page }) => {
  await page.goto("/model");
  await expect(page.getByRole("heading", { name: "How long will a court case take?" })).toBeVisible();
  await expect(page.getByTestId("model-answer")).toHaveCount(0);
  await page.getByRole("link", { name: "Explore case types", exact: true }).click();
  await expect(page).toHaveURL(/\/model\/explore$/);
  await expect(page.getByRole("heading", { name: "Explore a case type." })).toBeVisible();
  // the game's mood effects are off on this separate site
  await expect(page.locator("[data-fx=grain]")).toHaveCount(0);

  await page.getByTestId("topic-accident").click();
  await expect(page.getByTestId("topic-accident")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("model-district").selectOption("Madurai");
  const answer = page.getByTestId("model-answer");
  await expect(answer).toContainText("Road accident compensation · Madurai");
  await expect(page.getByTestId("model-takes")).toHaveText(/about \d|more than 4 years|a day or two/);
  await expect(page.getByTestId("model-probability")).toHaveText(/^(\d in 10|almost all|fewer than 1 in 10)$/);
  await expect(answer).toContainText("Still not over after");
  await expect(page.getByTestId("model-reasons").locator("li")).toHaveCount(3);
  // no jargon in the answer
  await expect(answer).not.toContainText(/log-odds|AUC|Kaplan|disposed/);

  await page.getByTestId("model-compare").selectOption("Chennai");
  await expect(page.getByTestId("model-compare-result")).toContainText("In Chennai");

  await page.getByTestId("model-sample").click();
  const sample = page.getByTestId("model-sample-result");
  await expect(sample).toContainText("The model guessed");
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

  const figures = page.locator("figure.resizable-figure");
  await expect(figures).toHaveCount(4);
  for (const figure of await figures.all()) {
    const sizeButton = figure.getByRole("button", { name: "Expand chart" });
    await expect(sizeButton).toHaveAttribute("aria-expanded", "false");
    await sizeButton.click();
    await expect(figure.getByRole("button", { name: "Show compact chart" })).toHaveAttribute("aria-expanded", "true");
    await figure.getByRole("button", { name: "Show compact chart" }).click();
  }
  const districtChart = page.locator("figure").filter({ hasText: "3. Where the case is filed matters too" });
  await districtChart.getByRole("button", { name: /Chennai/ }).click();
  await expect(districtChart.getByText("SELECTED DISTRICT")).toBeVisible();
  await expect(districtChart.locator(".chart-insight").getByText(/over within a year.*cases/)).toBeVisible();
  await districtChart.getByRole("button", { name: /Sort:/ }).click();
  await expect(districtChart.getByRole("button", { name: /lowest first/ })).toBeVisible();
  const stateChart = page.locator("figure").filter({ hasText: "4. Across India" });
  await stateChart.getByRole("button", { name: /Bihar/ }).click();
  await expect(stateChart.getByText("SELECTED STATE")).toBeVisible();
  await expect(stateChart.getByText(/2010 filings still open/)).toBeVisible();

  await page.getByRole("link", { name: "How it works" }).first().click();
  await expect(page).toHaveURL(/\/model\/about$/);
  await expect(page.getByRole("heading", { name: "In short" })).toBeVisible();
  await page.getByText("For the technical reader").click();
  await expect(page.getByText(/AUC 0\.8\d\d/)).toBeVisible();
});

test("the title screen links to the model", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /REAL DATA: COURT CASES/ }).click();
  await expect(page).toHaveURL(/\/model$/);
});


