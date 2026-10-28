import { expect, test, type Browser, type Page } from "@playwright/test";

// Runs against the REAL Python backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";

async function joinAs(browser: Browser, code: string, name: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`/play/${code}`);
  await page.getByLabel("Your detective name").fill(name);
  await page.getByRole("button", { name: "JOIN THE INVESTIGATION" }).click();
  await expect(page.getByTestId("play-lobby")).toContainText(`You're in, ${name}.`);
  return page;
}

test("class mode: lobby → round on phones → leaderboard → podium", async ({ browser, request }) => {
  test.setTimeout(150_000);
  const hostCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const host = await hostCtx.newPage();
  await host.goto("/host");
  await host.getByRole("button", { name: "START A CLASS SESSION" }).click();
  await expect(host).toHaveURL(/\/host\/[A-Z]{4}$/);
  const code = (await host.getByTestId("room-code").innerText()).trim();
  await expect(host.getByTestId("join-qr")).toBeVisible();

  const asha = await joinAs(browser, code, "Asha");
  const bilal = await joinAs(browser, code, "Bilal");
  await expect(host.getByTestId("name-chip")).toHaveCount(2);
  await expect(host.getByTestId("joined-count")).toHaveText("2 detectives joined");

  await host.getByTestId("level-card").first().click();
  await host.getByTestId("start-round").click();
  await expect(host.getByTestId("countdown")).toBeVisible();

  for (const phone of [asha, bilal]) {
    await expect(phone.getByTestId("play-case")).toBeVisible({ timeout: 20_000 });
  }
  const caseId = (await asha.getByTestId("play-case").getAttribute("data-case-id"))!;

  // Asha solves her case (through the API, as her phone would)
  const truth = await (await request.get(`${API}/api/debug/cases/${caseId}/truth`)).json();
  const ids: string[] = [];
  for (const tool of ["zscore", "iqr_box"]) {
    const res = await request.post(`${API}/api/cases/${caseId}/tools/${tool}`, { data: { params: {} } });
    ids.push((await res.json()).result_id);
  }
  await request.post(`${API}/api/cases/${caseId}/accuse`, {
    data: { suspect_id: truth.fraudster_id, evidence_ids: ids },
  });

  await expect(host.getByTestId("leaderboard-row").first()).toContainText("Asha", { timeout: 10_000 });
  await expect(host.getByTestId("solved-meter")).toContainText("1");
  await expect(host.getByTestId("ticker")).toContainText("Asha");

  await host.getByTestId("end-round").click();
  await expect(host.getByTestId("podium")).toBeVisible();
  await expect(host.getByTestId("podium-1")).toContainText("Asha", { timeout: 10_000 });
  await expect(asha.getByText("Round over.")).toBeVisible();
  await expect(host.getByTestId("open-autopsy")).toBeVisible();
});

test("an unknown room says so on the phone, before asking for a name", async ({ page }) => {
  await page.goto("/play/QQQQ");
  await expect(page.getByText("No such room.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("Your detective name")).toHaveCount(0);
});
