import type { Page } from "@playwright/test";

const TOOL_IDS: Record<string, string> = {
  "Case Summary": "summary",
  "Pattern Matrix": "groupby",
  "Z-Score Scan": "zscore",
  "Box & Whisker": "iqr_box",
  "Twin Finder": "duplicates",
  "Benford's Law": "benford",
  Timeline: "timeseries",
  "Margin Model": "regression",
  "Anomaly Hunter": "isoforest",
};

/** Tools are picked from the kit first, then run with the "Run · N coins" button. */
export async function runTool(page: Page, name: string) {
  const tile = page.locator(`[data-tool=${TOOL_IDS[name]}]`);
  if ((await tile.getAttribute("data-selected")) !== "true") await tile.getByRole("button").first().click();
  await page.getByRole("button", { name: `Run ${name}` }).click();
}
