import { expect, test, type APIRequestContext } from "@playwright/test";

// Runs against the REAL Python backend (AUDITOR_DEBUG=1) on :8000.
const API = process.env.API_URL ?? "http://localhost:8000";
const WS = API.replace(/^http/, "ws");

type Msg = { type: string; [key: string]: unknown };

/** A tiny Node WebSocket client (Node 22+ has a global WebSocket) that can await a message type. */
function connect(url: string) {
  const ws = new WebSocket(url);
  const inbox: Msg[] = [];
  const waiters: { type: string; resolve: (m: Msg) => void }[] = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(String(e.data)) as Msg;
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  };
  const opened = new Promise<void>((resolve) => (ws.onopen = () => resolve()));
  const next = (type: string) =>
    new Promise<Msg>((resolve) => {
      const i = inbox.findIndex((m) => m.type === type);
      if (i >= 0) resolve(inbox.splice(i, 1)[0]);
      else waiters.push({ type, resolve });
    });
  return { ws, opened, next };
}

async function play(request: APIRequestContext, caseId: string, tools: string[], correct: boolean) {
  const truth = await (await request.get(`${API}/api/debug/cases/${caseId}/truth`)).json();
  const meta = await (await request.get(`${API}/api/cases/${caseId}`)).json();
  const ids: string[] = [];
  for (const tool of tools) {
    const res = await request.post(`${API}/api/cases/${caseId}/tools/${tool}`, { data: { params: {} } });
    ids.push((await res.json()).result_id);
  }
  const suspect = correct
    ? truth.fraudster_id
    : meta.suspects.find((s: { id: string }) => s.id !== truth.fraudster_id).id;
  await request.post(`${API}/api/cases/${caseId}/accuse`, { data: { suspect_id: suspect, evidence_ids: ids.slice(0, 2) } });
}

test("autopsy deck walks through six slides and the detective card saves as PNG", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { code } = await (await request.post(`${API}/api/rooms`)).json();
  const stamp = Date.now();
  const host = connect(`${WS}/ws/rooms/${code}?role=host`);
  const players = [
    { id: `asha-${stamp}`, name: "Asha", tools: ["zscore", "iqr_box", "summary"], correct: true },
    { id: `bilal-${stamp}`, name: "Bilal", tools: ["summary", "groupby"], correct: false },
  ].map((p) => ({ ...p, sock: connect(`${WS}/ws/rooms/${code}?role=player&player_id=${p.id}&name=${p.name}`) }));
  await host.opened;
  for (const p of players) await p.sock.next("welcome");

  host.ws.send(JSON.stringify({ type: "start", level: 1, seconds: 300 }));
  for (const p of players) {
    const { case_id } = await p.sock.next("your_case");
    await play(request, case_id as string, p.tools, p.correct);
  }
  [host, ...players.map((p) => p.sock)].forEach((s) => s.ws.close());

  await page.goto(`/host/${code}/autopsy`);
  await expect(page.getByTestId("slide-counter")).toHaveText("1 / 7");
  await expect(page.getByText("The class becomes the dataset.")).toBeVisible();
  const titles = [
    "The verdicts",
    "Which tools did the class reach for?",
    "How long did it take?",
    "Does more analysis pay off?",
    "Which tool predicts success?",
    "Detective archetypes",
  ];
  for (const [i, title] of titles.entries()) {
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("slide-counter")).toHaveText(`${i + 2} / 7`);
    await expect(page.getByTestId("slide-title")).toHaveText(title);
  }
  await expect(page.getByTestId("autopsy-code")).toContainText("def ");

  await page.goto(`/profile/${players[0].id}`);
  await expect(page.getByTestId("archetype")).toHaveText(/The (Statistician|Gambler|Hacker|Visualizer)/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SAVE AS PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/^detective-.*\.png$/);
});
