import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { runTool } from "./fixtures/tools";

// Runs against the REAL Python backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";
const INTENDED: Record<string, [string, Record<string, string>]> = {
  big_invoice: ["iqr_box", {}],
  duplicates: ["duplicates", {}],
  fabricated: ["benford", {}],
  weekend: ["timeseries", {}],
  inflated_ratio: ["regression", {}],
  under_limit: ["isoforest", {}],
};

type Culprit = { fraudster_id: string; scheme: string; fraud_txn_ids: string[] };
type Truth = Culprit & { second: Culprit | null };

const THEORY_NAMES: Record<string, string> = {
  big_invoice: "One monster invoice", duplicates: "Billed twice", fabricated: "Made-up receipts",
  weekend: "Weekend payments", inflated_ratio: "Costs too big for the deal", under_limit: "Just under the approval limit",
};

/** Fill one accused's case file in the spotlight: the trick, then the fraud rows from their ledger. */
async function fileCharge(page: Page, index: number, culprit: Culprit) {
  const file = page.getByTestId("case-file").nth(index);
  await file.getByRole("radio", { name: THEORY_NAMES[culprit.scheme] }).click();
  await expect(file.getByTestId("proof-meter")).toContainText("PROVEN");
  await file.getByTestId("pick-rows").click();
  const picker = page.getByTestId("rows-picker");
  await expect(picker.getByTestId("ledger-row").first()).toBeVisible({ timeout: 15_000 });
  for (const id of culprit.fraud_txn_ids.slice(0, 3)) await picker.locator(`[data-txn="${id}"] td`).first().click();
  await picker.getByTestId("rows-done").click();
}

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
  await button.scrollIntoViewIfNeeded(); // the case files make the spotlight taller than the screen
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
  const culprits = [truth, ...(truth.second ? [truth.second] : [])];
  const accusations = [];
  for (const c of culprits) {
    let [tool, params] = INTENDED[c.scheme];
    if (!meta.unlocked_tools.includes(tool)) [tool, params] = ["groupby", { by: "vendor" }];
    const r = await (await request.post(`${API}/api/cases/${meta.case_id}/tools/${tool}`, { data: { params } })).json();
    accusations.push({ suspect_id: c.fraudster_id, theory: c.scheme, evidence_ids: [r.result_id], exhibits: c.fraud_txn_ids.slice(0, 3) });
  }
  if (opts.missCameo) {
    const accused = new Set(accusations.map((a) => a.suspect_id));
    const innocent = meta.suspects.map((s: { id: string }) => s.id).filter((id: string) => !accused.has(id));
    accusations[0].suspect_id = innocent[0]; // the cameo is culprit #1 in the Final's last case
    const rows = await (await request.get(`${API}/api/career/cases/${meta.case_id}/suspects/${innocent[0]}/rows`)).json();
    accusations[0].exhibits = [rows.rows[0].txn_id];
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
  await page.getByTestId("career-name").fill("Detective Rao");
  await page.getByTestId("start-career").click();
  await expect(page.getByTestId("offer")).toHaveCount(3);
  const code = (await page.getByTestId("career-code").innerText()).trim();
  await expect(page.getByTestId("career-player")).toContainText("DETECTIVE RAO");

  await page.locator("[data-testid=offer][data-company=lakshmi]").getByRole("button", { name: "SIGN" }).click();
  await expect(page.getByTestId("greetings")).toBeVisible();
  await expect(page.getByTestId("greetings")).toContainText("Imran Sheikh");
  await page.getByRole("button", { name: "GET TO WORK ▶" }).click();
  // day one: the senior hands over their notes
  await expect(page.getByTestId("senior-notes")).toContainText("Sharada Apte");
  await expect(page.getByTestId("senior-notes")).toContainText("WHAT PROVES A CASE");
  await page.getByRole("button", { name: "GOT IT" }).click();
  await page.getByTestId("open-case").click();
  await expect(page.getByText("Lakshmi Sweets & Caterers — Case 1 of 5 · Easy")).toBeVisible();
  await page.getByRole("button", { name: "OPEN THE FILES" }).click();

  await expect(page.getByTestId("case-title")).toContainText("Lakshmi Sweets");
  await expect(page.getByText("Case 1 of 5", { exact: true })).toBeVisible();
  const caseId = page.url().split("/case/")[1];
  const truth: Truth = await (await request.get(`${API}/api/debug/cases/${caseId}/truth`)).json();
  await expect(page.getByTestId("case-notes")).toBeVisible(); // the notes stay one tap away
  // one test that fits the trick is enough
  await runTool(page, "Box & Whisker");
  await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  await page.keyboard.press("b");
  await expect(page.getByTestId("corkboard")).toBeVisible();
  await page.waitForTimeout(600);
  const suspect = page.locator(`[data-testid=board-suspect][data-suspect=${truth.fraudster_id}]`);
  await drag(page, page.getByTestId("board-evidence").nth(0), suspect);
  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  await expect(page.getByTestId("spotlight")).toBeVisible();
  await fileCharge(page, 0, truth);
  await hold(page);

  await expect(page).toHaveURL(new RegExp(`/case/${caseId}/verdict`), { timeout: 15_000 });
  await expect(page.getByTestId("rating-total")).toBeVisible({ timeout: 15_000 });
  expect(Number((await page.getByTestId("rating-total").innerText()).split("/")[0])).toBeGreaterThanOrEqual(95);
  await expect(page.getByTestId("case-rating")).toContainText("Exhibits");
  await expect(page.getByTestId("contract-progress")).toContainText("Case 1 of 5");
  await expect(page.getByTestId("next-case")).toBeVisible({ timeout: 10_000 });

  // NEXT CASE opens case 2's briefing directly
  await page.getByTestId("next-case").click();
  await expect(page.getByText("Lakshmi Sweets & Caterers — Case 2 of 5 · Easy")).toBeVisible();
  // ...and opening its files lands on case 2's own desk, not the one just closed
  await page.getByRole("button", { name: "OPEN THE FILES" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/case/${caseId}`), { timeout: 10_000 });
  await page.waitForTimeout(2500); // long enough for a stray restore of case 1 to show up
  await expect(page).not.toHaveURL(new RegExp(`/case/${caseId}`));
  await expect(page.getByText("Case 2 of 5")).toBeVisible();

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
  // one test that fits each fraud
  const tools: Record<string, string> = { duplicates: "Twin Finder", fabricated: "Benford's Law", weekend: "Timeline",
    inflated_ratio: "Margin Model", under_limit: "Anomaly Hunter", big_invoice: "Box & Whisker" };
  for (const scheme of [truth.scheme, truth.second!.scheme]) {
    await runTool(page, tools[scheme]);
    await expect(page.getByTestId("result-view")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "📌 Pin as evidence" }).click();
  }
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
  await expect(page.getByTestId("pair-picker")).toBeVisible();
  // only one suspect has a clue so far: the accusation stays locked
  await expect(page.getByRole("button", { name: "MAKE THE ACCUSATION" })).toBeDisabled();
  await tie(1, b);
  const picker = page.getByTestId("pair-picker");
  for (const id of [truth.fraudster_id, truth.second!.fraudster_id]) {
    const name = meta.suspects.find((s: { id: string }) => s.id === id).name;
    await picker.getByRole("button", { name: new RegExp(name) }).click();
  }
  await page.getByRole("button", { name: "MAKE THE ACCUSATION" }).click();
  await expect(page.getByTestId("accused-pair")).toBeVisible();
  // the spotlight lists the accused in lineup order
  const order = meta.suspects.map((s: { id: string }) => s.id);
  const inLineup = [truth, truth.second!].sort((x, y) => order.indexOf(x.fraudster_id) - order.indexOf(y.fraudster_id));
  for (const [i, c] of inLineup.entries()) await fileCharge(page, i, c);
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
