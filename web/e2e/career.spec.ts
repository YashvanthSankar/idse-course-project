import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { runTool } from "./fixtures/tools";

// Runs against the REAL Python backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";
const INTENDED: Record<string, [string, Record<string, string>]> = {
  big_invoice: ["zscore", {}],
  duplicates: ["duplicates", {}],
  fabricated: ["benford", {}],
  weekend: ["timeseries", {}],
  inflated_ratio: ["regression", {}],
  under_limit: ["isoforest", {}],
};

type Truth = { fraudster_id: string; scheme: string; second: { fraudster_id: string; scheme: string } | null };

async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function hold(page: Page) {
  const button = page.getByTestId("hold-to-accuse");
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1900);
  await page.mouse.up();
}

/** Play the career's current case through the API, the way a sharp detective would. */
async function playViaApi(request: APIRequestContext, code: string, opts: { missCameo?: boolean } = {}) {
  const meta = await (await request.post(`${API}/api/career/${code}/case`)).json();
  const truth: Truth = await (await request.get(`${API}/api/debug/cases/${meta.case_id}/truth`)).json();
  const state = await (await request.get(`${API}/api/cases/${meta.case_id}/state`)).json();
  const culprits = [truth, ...(truth.second ? [truth.second] : [])];
  const spare = [state.results[0].result_id];
  const accusations = [];
  for (const c of culprits) {
    let [tool, params] = INTENDED[c.scheme];
    if (!meta.unlocked_tools.includes(tool)) [tool, params] = ["groupby", { by: "vendor" }];
    const r = await (await request.post(`${API}/api/cases/${meta.case_id}/tools/${tool}`, { data: { params } })).json();
    accusations.push({ suspect_id: c.fraudster_id, evidence_ids: [r.result_id] });
  }
  if (culprits.length === 2) {
    const extra = await (await request.post(`${API}/api/cases/${meta.case_id}/tools/groupby`, { data: { params: { by: "category" } } })).json();
    spare.push(extra.result_id);
  }
  accusations.forEach((a, i) => a.evidence_ids.push(spare[i]));
  if (opts.missCameo) {
    const accused = new Set(accusations.map((a) => a.suspect_id));
    const innocent = meta.suspects.map((s: { id: string }) => s.id).filter((id: string) => !accused.has(id));
    accusations[0].suspect_id = innocent[0]; // the cameo is culprit #1 in the Final's last case
  }
  const res = await request.post(`${API}/api/career/cases/${meta.case_id}/accuse`, { data: { accusations } });
  expect(res.ok()).toBeTruthy();
  return { caseId: meta.case_id as string, verdict: await res.json() };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem("e2e-started")) {
        localStorage.removeItem("auditor.career.v1");
        sessionStorage.setItem("e2e-started", "1");
      }
    } catch {}
  });
});

test("prologue → offers → first company → solve case 1 in the browser → rating → appraisal", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.goto("/career");
  await page.getByRole("button", { name: "SKIP ▶▶" }).click();
  await page.getByTestId("start-career").click();
  await expect(page.getByTestId("offer")).toHaveCount(3);
  const code = (await page.getByTestId("career-code").innerText()).trim();

  await page.locator("[data-testid=offer][data-company=lakshmi]").getByRole("button", { name: "SIGN" }).click();
  await expect(page.getByTestId("greetings")).toBeVisible();
  await expect(page.getByTestId("greetings")).toContainText("Imran Sheikh");
  await page.getByRole("button", { name: "GET TO WORK ▶" }).click();
  await page.getByTestId("open-case").click();
  await expect(page.getByText("Lakshmi Sweets & Caterers — Case 1 of 5 · Easy")).toBeVisible();
  await page.getByRole("button", { name: "OPEN THE FILES" }).click();

  await expect(page.getByTestId("case-title")).toContainText("Lakshmi Sweets");
  await expect(page.getByText("Case 1 of 5", { exact: true })).toBeVisible();
  const caseId = page.url().split("/case/")[1];
  const truth: Truth = await (await request.get(`${API}/api/debug/cases/${caseId}/truth`)).json();
  for (const tool of ["Z-Score Scan", "Box & Whisker"]) {
    await runTool(page, tool);
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }
  await page.keyboard.press("b");
  await expect(page.getByTestId("corkboard")).toBeVisible();
  await page.waitForTimeout(600);
  const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${truth.fraudster_id}]`);
  for (const i of [0, 1]) await drag(page, page.getByTestId("board-evidence").nth(i), suspect);
  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  await expect(page.getByTestId("spotlight")).toBeVisible();
  await hold(page);

  await expect(page).toHaveURL(new RegExp(`/case/${caseId}/verdict`), { timeout: 15_000 });
  await expect(page.getByTestId("rating-total")).toBeVisible({ timeout: 15_000 });
  expect(Number((await page.getByTestId("rating-total").innerText()).split("/")[0])).toBeGreaterThanOrEqual(85);
  await expect(page.getByTestId("contract-progress")).toContainText("Case 1 of 5");
  await expect(page.getByTestId("next-case")).toBeVisible({ timeout: 10_000 });

  // NEXT CASE opens case 2's briefing directly
  await page.getByTestId("next-case").click();
  await expect(page.getByText("Lakshmi Sweets & Caterers — Case 2 of 5 · Easy")).toBeVisible();

  // The rest of the contract, played fast through the API → the appraisal on the hub
  for (let i = 0; i < 4; i++) await playViaApi(request, code);
  await page.goto("/career");
  await expect(page.getByTestId("appraisal")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("appraisal-band")).toHaveText(/EXCEPTIONAL|GOOD/);
  await page.getByRole("button", { name: "BACK TO THE DESK" }).click();
  await expect(page.locator("[data-testid=offer]").first()).toBeVisible();
  await expect(page.getByTestId("career-salary")).not.toHaveText("₹6 LPA");
});

test("a very hard case: two fraudsters, the pair picker and two stacked clue groups", async ({ page, request }) => {
  test.setTimeout(180_000);
  const career = await (await request.post(`${API}/api/career`)).json();
  const code = career.code;
  await request.post(`${API}/api/career/${code}/debug-jump`, { data: { offers: ["deccan"], tier: "large", salary: 120 } });
  await request.post(`${API}/api/career/${code}/sign`, { data: { company_id: "deccan" } });
  for (let i = 0; i < 4; i++) await playViaApi(request, code);
  const meta = await (await request.post(`${API}/api/career/${code}/case`)).json();
  expect(meta.career.culprits).toBe(2);
  const truth: Truth = await (await request.get(`${API}/api/debug/cases/${meta.case_id}/truth`)).json();

  await page.addInitScript((c) => localStorage.setItem("auditor.career.v1", c), code);
  await page.goto(`/case/${meta.case_id}`);
  await expect(page.getByText("Case 5 of 5 · two fraudsters")).toBeVisible();
  // pin the free summary and three more results, two to each fraudster
  const tools: Record<string, string> = { duplicates: "Twin Finder", fabricated: "Benford's Law", weekend: "Timeline",
    inflated_ratio: "Margin Model", under_limit: "Anomaly Hunter", big_invoice: "Z-Score Scan" };
  for (const scheme of [truth.scheme, truth.second!.scheme, "_extra"]) {
    await runTool(page, tools[scheme] ?? "Pattern Matrix");
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }
  // the free Case Summary is the fourth clue
  await page.getByRole("tab", { name: /Case Summary/ }).click();
  await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  await page.keyboard.press("b");
  await expect(page.getByTestId("corkboard")).toBeVisible();
  await page.waitForTimeout(600);
  const a = page.locator(`[data-testid=board-suspect][data-suspect=${truth.fraudster_id}]`);
  const b = page.locator(`[data-testid=board-suspect][data-suspect=${truth.second!.fraudster_id}]`);
  // seven suspects make a tall board: tap the photo, then the suspect (taps scroll for us)
  const tie = async (i: number, who: Locator) => {
    await page.getByTestId("board-evidence").nth(i).click();
    await who.click();
  };
  await tie(0, a);
  await tie(1, b);
  await tie(2, a);
  await expect(page.getByTestId("pair-picker")).toBeVisible();
  // only one suspect has two clues so far: the accusation stays locked
  await expect(page.getByRole("button", { name: "MAKE THE ACCUSATION" })).toBeDisabled();
  await tie(3, b);
  const picker = page.getByTestId("pair-picker");
  for (const id of [truth.fraudster_id, truth.second!.fraudster_id]) {
    const name = meta.suspects.find((s: { id: string }) => s.id === id).name;
    await picker.getByRole("button", { name: new RegExp(name) }).click();
  }
  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  await expect(page.getByTestId("accused-pair")).toBeVisible();
  await hold(page);
  await expect(page).toHaveURL(new RegExp(`/case/${meta.case_id}/verdict`), { timeout: 15_000 });
  await expect(page.getByTestId("case-rating")).toContainText("You caught 2 of the 2 fraudsters", { timeout: 15_000 });
  await expect(page.getByTestId("see-appraisal")).toBeVisible({ timeout: 15_000 });
});

test("the Final: the old colleague escapes, the cutscene plays, the story ends", async ({ page, request }) => {
  test.setTimeout(240_000);
  const code = (await (await request.post(`${API}/api/career`)).json()).code;
  await request.post(`${API}/api/career/${code}/debug-jump`, { data: { offers: ["kaveri"], tier: "very_large", salary: 200 } });
  await request.post(`${API}/api/career/${code}/sign`, { data: { company_id: "kaveri" } });
  await playViaApi(request, code);
  await playViaApi(request, code);
  const { caseId, verdict } = await playViaApi(request, code, { missCameo: true });
  expect(verdict.cutscene.kind).toBe("escaped");

  await page.addInitScript((c) => localStorage.setItem("auditor.career.v1", c), code);
  await page.goto(`/case/${caseId}/verdict`);
  await page.getByTestId("what-happened").click({ timeout: 20_000 });
  await expect(page.getByTestId("cutscene")).toBeVisible();
  await expect(page.getByTestId("cutscene")).toContainText("GONE");
  for (let i = 0; i < 10 && (await page.getByTestId("cutscene-next").innerText()) !== "FREE PLAY ▶"; i++) {
    await page.getByTestId("cutscene-next").click();
  }
  await expect(page.getByText("They were with you from the start.")).toBeVisible();
  await page.getByTestId("cutscene-next").click();
  await expect(page).toHaveURL(/\/career$/);
  await expect(page.getByTestId("story-over")).toBeVisible();
  await expect(page.getByTestId("career-goal")).toContainText("They got away");
});
