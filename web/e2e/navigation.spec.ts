import { expect, test } from "@playwright/test";

const API = "http://localhost:8000";

test("every screen has a visible way back", async ({ page, request }) => {
  await page.goto("/office");
  await page.getByRole("link", { name: "← Menu" }).click();
  await expect(page).toHaveURL(/\/$/);

  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 2 } })).json();
  await page.goto(`/case/${meta.case_id}`);
  await page.getByRole("link", { name: "← Case desk" }).click();
  await expect(page).toHaveURL(/\/office$/);

  await page.goto("/host");
  await page.getByRole("link", { name: "← Menu" }).click();
  await expect(page).toHaveURL(/\/$/);

  const room = await (await request.post(`${API}/api/rooms`)).json();
  await page.goto(`/play/${room.code}`);
  await page.getByRole("link", { name: "← Menu" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test("the case back button fits on a phone", async ({ page, request }) => {
    const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 3 } })).json();
    await page.goto(`/case/${meta.case_id}`);
    await expect(page.getByRole("link", { name: "← Case desk" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("verdict, detective card and autopsy have a back button at the top", async ({ page, request }) => {
  const meta = await (await request.post(`${API}/api/cases`, { data: { level: 1, seed: 9, player_id: "nav-p" } })).json();
  const truth = await (await request.get(`${API}/api/debug/cases/${meta.case_id}/truth`)).json();
  const ids = [];
  for (const t of ["zscore", "iqr_box"]) {
    ids.push((await (await request.post(`${API}/api/cases/${meta.case_id}/tools/${t}`, { data: { params: {} } })).json()).result_id);
  }
  await request.post(`${API}/api/cases/${meta.case_id}/accuse`, { data: { suspect_id: truth.fraudster_id, evidence_ids: ids } });
  await page.goto(`/case/${meta.case_id}/verdict`);
  await page.getByRole("link", { name: "← Case desk" }).first().click();
  await expect(page).toHaveURL(/\/office$/);

  await page.goto("/profile/nav-p");
  await page.getByRole("link", { name: "← Menu" }).click();
  await expect(page).toHaveURL(/\/$/);

  const room = await (await request.post(`${API}/api/rooms`)).json();
  await page.goto(`/host/${room.code}/autopsy`);
  await expect(page.getByRole("link", { name: `← Room ${room.code}` })).toBeVisible();
});
