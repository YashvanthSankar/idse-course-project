# THE AUDITOR: Game Design Spec

> *"Every number tells a story. Some of them lie."*

A noir detective web game where you catch corporate fraudsters using real Python data analysis
(numpy, pandas, scipy, scikit-learn, Plotly, seaborn). Built for the IDSE course: the game must
look and feel like a real web game, and **every decision the game makes must be visibly real
Python data analysis**.

---

## 1. Goals

| # | Goal | How we know |
|---|------|-------------|
| G1 | Feels like a real web game, not a course assignment | Title screen, story, sound, animation, mobile play |
| G2 | All analysis runs in Python and is shown to the player | Every tool result has an "Under the hood" drawer showing the real function source (`inspect.getsource`) |
| G3 | Teaches the syllabus through play | Each level is solved by one core technique (z-score, groupby, Benford, time series, regression, IsolationForest) |
| G4 | Wins the presentation | Class Mode: 200 students play live on phones, then the Class Autopsy analyzes their own play data with pandas |
| G5 | Defensible in the viva | Three notebooks reuse the exact package that powers the game |

**Non-goals:** user accounts or passwords, a persistent global leaderboard across days, native mobile apps, multiple languages.

---

## 2. Core Loop

```
Briefing → Investigate (Tool Board) → Pin Evidence (Corkboard) → Accuse (2 evidence) → Verdict → Reveal
```

- **Case:** a procedurally generated transactions table (~800–1,500 rows) for 5 suspects. Exactly one is the fraudster.
- **Budget:** every tool costs points. Re-running the same tool with the same params is free (cached).
  Running a tool with `cost > budget_left` is refused. Accusing is always allowed, even at 0 budget.
- **Evidence:** any tool result can be pinned. Hacker Mode notes **cannot** be pinned, because the server cannot verify them.
- **Accusation:** choose 1 suspect and attach **exactly 2** distinct evidence items. If more than 2 are tied to the suspect, the player picks which 2 to file. If the budget is spent, the player files every clue they have (0 or 1), so nobody can get stuck. One accusation per case, and it is final.
- **Verdict:** a GUILTY or WRONG SUSPECT stamp, a score breakdown, then the Reveal (the fraud rows light up and the technique that catches them is explained).

### 2.1 Scoring (computed server-side)

```
if accused != fraudster:            score = 0   (the Reveal still shows)
else:
  base          = 1000
  evidence      = Σ over the 2 items:
                    +250  STRONG      tool ∈ case.catching_tools AND accused ∈ implicates AND len(implicates) ≤ 2
                    +100  SUPPORTIVE  accused ∈ implicates AND len(implicates) ≤ 2 (tool not catching)
                       0  WEAK        accused ∈ implicates but len(implicates) > 2
                    -100  IRRELEVANT  accused ∉ implicates
  budget_bonus  = 20 × budget_left
  time_bonus    = max(0, 300 − elapsed_seconds // 2)
  score         = max(0, base + evidence + budget_bonus + time_bonus)
```
Elapsed time is measured on the server from case creation, or from round start in Class Mode.

---

## 3. Case Data Model

Columns of the player-visible table (truth is **never** included):

| column | type | notes |
|---|---|---|
| `txn_id` | str | `T00001` … |
| `date` | date | 90-day window; the office is closed Sat/Sun (legit weekend share ≈ 2%) |
| `hour` | int 0–23 | legit hours are mostly 9–20 |
| `employee_id` | str | `E1`…`E5` = the suspects |
| `vendor` | str | about 25 vendors, Indian-flavoured names |
| `category` | str | `chai_snacks`, `cab`, `client_meal`, `hotel`, `flight`, `equipment`, `festival_bonus` |
| `amount` | float INR | per-category lognormal; the category mixture spans ~3 decades, so honest data ≈ Benford |
| `revenue` | float INR | revenue of the deal the expense served; legit `amount/revenue` ≈ lognormal around 0.05 |
| `invoice_id` | str | unique per legit row |

**Suspects:** 5 per case, drawn from a pool (name, role, department, a one-line noir bio, a portrait key). Levels with the
`ceo` red herring always include the CEO as a suspect.

**Red herrings:**
- `ceo`: the CEO's spending is legitimately ~4× larger. Global z-scores flag them; per-employee z-scores do not.
- `diwali`: everyone receives a `festival_bonus` in one week. These rows are big and clustered, but innocent.

---

## 4. Levels & Tool Unlocks

| L | Title | Scheme | Budget | Red herrings | Catching tools | Unlocks |
|---|---|---|---|---|---|---|
| 1 | The Midnight Invoice | `big_invoice`: 1–2 txns at 12–16× that employee's category median | 8 | ceo | zscore, iqr_box | summary, groupby, zscore, iqr_box |
| 2 | Déjà Vu | `duplicates`: ~8 invoices re-submitted (same vendor and amount, 1–3 days later, new invoice_id) | 8 | none | duplicates | duplicates |
| 3 | Too Random To Be True | `fabricated`: every claim invented, with realistic size but a random leading digit (flat digits) | 10 | none | benford | benford |
| 4 | Weekend Warrior | `weekend`: ~15 personal purchases on Sat/Sun | 10 | diwali | timeseries | timeseries |
| 5 | The Margin Call | `inflated_ratio`: every travel and dining claim padded 1.6–2.0× vs. its deal revenue | 12 | none | regression | regression |
| 6 | Ghost Vendor | `under_limit`: ~12 txns of 45,000–49,999 (just under the 50k approval limit), 1–4 AM, to a vendor nobody else uses | 14 | ceo, diwali | isoforest, groupby | isoforest |
| 7+ | Adaptive (endless) | chosen by the Adaptive Fraudster (§6) | 14 | random | per scheme | — |

---

## 5. Detection Contract (the Tools)

Every tool is a pure function `analyze(df, **params) -> Analysis` plus a Plotly chart. Each result reports `implicates`
(suspect ids). **This contract is what makes the game fair, and property tests enforce it.**

| tool_id | Name | Cost | Params | What it computes | `implicates` rule |
|---|---|---|---|---|---|
| `summary` | Case Summary | 1 | — | per-employee `describe()` of amount | always `[]` (information only) |
| `groupby` | Pattern Matrix | 1 | `by ∈ {weekday, vendor, category, hour_bucket}` | employee × `by` count heatmap; chi-square of each employee's distribution vs. everyone else's (for `vendor`: vendor exclusivity, because honest people have favourite vendors) | p < 0.001; for `vendor`: ≥ 5 claims at vendors only they use |
| `zscore` | Z-Score Scan | 2 | `scope ∈ {per_employee, global}`, `threshold=3.0` | per_employee: z of `log10(amount)` within (employee, category). global: naive z of raw rupees (flags expensive categories and the CEO, which is the red-herring lesson) | employees with ≥ 1 row \|z\| > threshold |
| `iqr_box` | Box & Whisker | 2 | — | per-person boxplot of each claim relative to their own usual claim in that category (log10) | employees with a point > Q3 + 3·IQR |
| `duplicates` | Twin Finder | 2 | — | rows with the same (employee, vendor, amount) ≤ 7 days apart | employees with ≥ 3 twin pairs |
| `benford` | Benford's Law | 3 | — | first-digit distribution per employee vs. `log10(1+1/d)`, chi-square | employees with n ≥ 50 and p < 1e-5 (measured: honest ≥ 6e-5, forgers ≤ 2e-6); n < 50 → reported `inconclusive`, never implicated |
| `timeseries` | Timeline | 3 | `freq ∈ {D, W}` | spend over time with weekend shading; weekend share per employee | one-sided binomial test of their weekend count vs. the rest of the company's weekend rate, p < 0.001 |
| `regression` | Margin Model | 4 | — | OLS `log(amount) ~ log(revenue)`; mean standardized residual per employee, one-sample t-test | employees with mean resid > 0 and p < 0.001 |
| `isoforest` | Anomaly Hunter (ML) | 5 | — | IsolationForest on [size vs. own usual, hour, vendor popularity], `contamination=0.02`, `random_state=0` | employees with ≥ 6 flagged rows AND flagged share > 3 × the median share |

**Fairness properties (tested over seeds 0–19 for every level 1–6):**
- P1: each catching tool implicates the fraudster in ≥ 95% of seeds, with `len(implicates) ≤ 2`.
- P2: on an honest case (no scheme injected), every tool implicates nobody in ≥ 90% of seeds.
- P3: `build_case(level, seed)` is deterministic: same seed, identical DataFrame and truth.

**Honesty rule:** a result's `code` field is `inspect.getsource(tool.analyze)`, i.e. the code that actually ran.

---

## 6. Adaptive Fraudster

The player's tool usage profile is `Counter(tool_id)` from their past `tool_run` events. `pick_scheme(profile, rng)`:
take the player's **top 2** tools, keep the schemes whose catching tools don't overlap them, and pick one with `rng`.
If none remain, pick from all schemes. The Briefing teases this: *"Word on the street is you love your Z-scores…"*

---

## 7. Hacker Mode

A code console (CodeMirror) running **real Python in the browser via Pyodide**, with pandas preloaded and the case
loaded as `df` from `GET /api/cases/{id}/data.csv`. Each run costs 1 budget (charged via the API before execution).
Output: stdout plus DataFrame HTML. Results are notes only and cannot be pinned (see §2).

---

## 8. Class Mode, Autopsy, Profiles

**Flow:**
1. The professor's laptop opens `/host` → room code (4 letters, no I/O) + a QR code to `/play/CODE`.
2. Students scan, choose a nickname and join. Name chips pop onto the projector.
3. The host picks a level and presses **Start**. The server creates one case per player with the **same (level, seed)**.
4. Students play on their phones. The projector shows a live leaderboard (animated reordering), an activity ticker
   ("Priya ran Benford's Law"), the countdown ring (default 6 min) and a solved meter.
5. The round ends by timer or host button → podium → **Class Autopsy**.

**Reconnect:** a player who drops (phone locks) rejoins with the same `player_id` (kept in localStorage) and keeps
their case and score.

**Class Autopsy** (`GET /api/rooms/{code}/autopsy`): a slide sequence for the projector. Each slide shows a
chart next to the pandas code that made it:
1. Solve rate + median time to accuse
2. Tool usage counts
3. Time-to-accuse histogram, correct vs. wrong
4. Accuracy vs. number of tools used, with Pearson r and p
5. "Which tool predicts success?" Success rate of users vs. non-users per tool, chi-square p
6. Detective archetypes across the class (cluster sizes)

**Detective Profiles:** per-player features `[n_tools, distinct_tools, budget_spent_ratio, seconds_to_accuse,
correct, visual_tool_share, hacker_queries]` → StandardScaler → KMeans(k=4, random_state=0). Archetypes are named
by centroid: highest correct + distinct_tools → **The Statistician**; lowest n_tools + fastest → **The Gambler**;
highest hacker_queries → **The Hacker**; remaining → **The Visualizer**. With fewer than 8 players, fall back to
the same rules applied per player without clustering. Shown as a shareable trading card (downloadable PNG).

**Case Report PDF** (`GET /api/cases/{id}/report.pdf`, only after a verdict): 3 pages made with seaborn/matplotlib:
summary, fraud rows highlighted, the catching technique's chart.

---

## 9. UI & Art Direction

**Mood:** Mumbai, 2 AM, monsoon. Rain on the window, desk lamp, manila folders, neon reflected in puddles,
red string on a corkboard. Cinematic, tactile, dark.

### 9.1 Design tokens (dark only)
| token | value | use |
|---|---|---|
| `--ink-950` | `#07080B` | page background |
| `--ink-900` | `#0E1117` | panels |
| `--ink-800` | `#161B24` | raised panels |
| `--line` | `#2A3140` | borders |
| `--paper` | `#EFE6D2` | case files, polaroids |
| `--paper-shade` | `#CDBF9F` | paper edges and shadows |
| `--amber` | `#F5A524` | lamp light, primary actions, budget |
| `--red` | `#E5484D` | evidence string, GUILTY, fraud rows |
| `--green` | `#3DD68C` | terminal and code, correct |
| `--cyan` | `#4CC9F0` | neon accents, data highlights |
| `--text` | `#E8E6E1` | body text |
| `--muted` | `#8B93A3` | secondary text |

**Type:** `Playfair Display` (titles, cinematic italic), `Special Elite` (typewritten case files and memos),
`Inter` (UI), `JetBrains Mono` (code, numbers). All via `next/font/google`.

**Plotly theme:** a Python-registered template `"noir"`: transparent background, `--line` grid, colorway
`[amber, cyan, paper, green, red, muted]`, Inter font. Fraud or flagged marks are always `--red`.

### 9.2 Global FX layer
Film grain (animated noise), vignette, canvas rain (~300 drops, pauses when the tab is hidden), desk-lamp radial
light following the cursor, screen shake, typewriter text. All motion is disabled under `prefers-reduced-motion`.

### 9.3 Sound (Howler.js; CC0 sources such as Pixabay/Freesound, credited in `web/public/sfx/CREDITS.md`)
rain loop, lo-fi noir jazz loop (low volume), typewriter keys, paper rustle, pin push, string pull, coin drop (budget
spend), stamp thud, heartbeat, correct chime, wrong buzzer. Audio starts on the first user gesture. Master
volume + mute are persisted in localStorage.

### 9.4 Screens
1. **Title `/`**: rain and a Mumbai skyline silhouette with mouse parallax. A flickering neon sign reading "THE AUDITOR".
   The menu is typed out: *New Case · Class Mode · Detective's Manual · Settings*. "Press any key".
2. **Office `/office`**: a top-down desk. Case folders are manila cards; locked cases are sealed with red tape. Hovering
   lifts a card with a paper rustle. Each card shows case no., title, difficulty stars and a best-score stamp.
3. **Briefing** (modal): the Chief's memo is typewritten with sound, suspect polaroids slide in, then "Open the files".
4. **Investigation `/case/[id]`**:
```
┌ CASE #03 · Too Random To Be True ─────────── ⏱ 02:41 ──── BUDGET ●●●●●●○○○○ 6/10 ┐
│ SUSPECTS  │  WORKSPACE                                           │ EVIDENCE TRAY  │
│ ▣ Priya   │  ┌ Benford's Law ───────────────────────────────┐    │ ▣ Benford/Priya│
│ ▣ Arjun   │  │      (interactive Plotly chart)               │    │ ▣ Z-scan       │
│ ▣ Meera   │  └───────────────────────────────────────────────┘    │                │
│ ▣ Kabir   │  χ² = 48.2 · p < 0.0001 — Priya's digits are too flat │ [Open Board]   │
│ ▣ Mr. K   │  [📌 Pin as evidence]   [</> Under the hood]  [Data]  │                │
├───────────┴───────────────────────────────────────────────────────┴────────────────┤
│ TOOL KIT: [Σ Summary·1] [▦ Pattern·1] [z Z-Scan·2] [▢ Box·2] [⧉ Twins·2] [1 Benford·3] [🔒…] │
└────────────────────────────────────────────────────────────────────────────────────┘
```
   Running a tool plays a terminal sequence (its real code streams in fast, green on black, ~800 ms), then the chart
   animates in and coins drop off the budget meter. **Data** opens a virtualized raw table (TanStack Table + Virtual)
   with flagged rows tinted red. **Under the hood** slides up a drawer with the Shiki-highlighted source and stats.
   Locked tools show "Unlocks at Case N". Mobile layout: bottom tabs *Suspects / Tools / Result / Board*.
5. **Corkboard** (overlay): cork texture, suspect polaroids along the top, evidence polaroids (chart thumbnails)
   draggable with dnd-kit. Dropping evidence on a suspect draws a sagging red SVG string (animated stroke). A suspect
   with 2 strings gets "Make the accusation".
6. **Accusation**: the screen dims to a spotlight on the suspect with a heartbeat sound and their line ("You've got nothing
   on me…"). **Hold to accuse** for 1.5 s (ring fills).
7. **Verdict**: a rubber stamp slams GUILTY or WRONG SUSPECT, with shake and thud. The score counts up line by line
   (base, evidence, budget, time) with ticks, plus confetti if correct.
8. **Reveal**: "How they did it." Fraud rows light up red one by one in a scatter, followed by the explanation and the
   catching tool's code. Buttons: *Next case · Download case report (PDF) · Detective card*.
9. **Host `/host/[code]`** (designed for a 1920×1080 projector): huge room code + QR, name chips springing in,
   a "143 detectives joined" counter. During the round: an animated leaderboard (Framer `layout`), activity ticker, countdown
   ring, solved meter. At the end: a top-3 podium.
10. **Play `/play/[code]`** (designed for a 375 px phone): nickname, then a lobby saying "Look up at the big screen", then the mobile investigation.
11. **Autopsy `/host/[code]/autopsy`**: a full-screen slide deck (arrow keys). Each slide has a chart on the left and its pandas code on the right.
12. **Profile `/profile/[playerId]`**: a trading-card detective profile with the archetype, a radar chart and stats; "Save as PNG".

**Motion rules:** UI transitions 150–400 ms. Cards use springs. Big moments (stamp, spotlight) get one sound each.
Never animate while a chart is loading. Keyboard: number keys 1–9 run tools, `B` opens the board, `Esc` closes overlays.

---

## 10. Architecture

```
 Browser (Next.js)                                   Python brain (FastAPI, 1 uvicorn worker)
 ┌──────────────────────────────┐   REST + WS    ┌───────────────────────────────────────────┐
 │ App Router · TS · Tailwind   │ ◄────────────► │ auditor.generator  (numpy/pandas cases)   │
 │ shadcn/ui · Framer Motion    │                │ auditor.tools      (scipy/sklearn tests)  │
 │ Zustand · TanStack Query     │                │ auditor.charts     (plotly → JSON)        │
 │ react-plotly.js · dnd-kit    │                │ auditor.scoring · auditor.adapt           │
 │ Howler · Shiki · Pyodide     │                │ auditor.rooms      (WebSocket class mode) │
 └──────────────────────────────┘                │ auditor.autopsy · auditor.profiles (KMeans)│
                                                 │ auditor.report     (seaborn PDF)          │
                                                 │ SQLite telemetry  ── pd.read_sql ─►       │
                                                 └───────────────────────────────────────────┘
```

Class Mode runs on FastAPI WebSockets with in-memory rooms. Telemetry is stored in SQLite and read back with pandas. Everything is Python, with no external database.

### 10.1 API contract
| Method | Path | Body → Response |
|---|---|---|
| POST | `/api/cases` | `{level, seed?, player_id?}` → `CaseMeta` |
| GET | `/api/cases/{id}/rows?offset&limit` | → `{rows: [...], total}` |
| GET | `/api/cases/{id}/data.csv` | → CSV (no truth) |
| GET | `/api/tools?level=` | → `[ToolSpec]` (id, name, cost, params schema, unlocked) |
| POST | `/api/cases/{id}/tools/{tool_id}` | `{params}` → `ToolResult` · 409 if over budget · 403 if locked |
| POST | `/api/cases/{id}/hacker-charge` | → `{budget_left}` · 409 if over budget |
| POST | `/api/cases/{id}/accuse` | `{suspect_id, evidence_ids[2]}` → `Verdict` (idempotent: a repeat returns the stored verdict) |
| GET | `/api/cases/{id}/report.pdf` | → PDF · 409 before verdict |
| POST | `/api/rooms` | → `{code}` |
| WS | `/ws/rooms/{code}?role=host\|player&player_id&name` | messages in §10.2 |
| GET | `/api/rooms/{code}/autopsy` | → `{slides: [{title, figure, code, stats}]}` |
| GET | `/api/players/{player_id}/profile` | → `Profile` |

### 10.2 WebSocket messages (`{"type": ..., ...}`)
Server→host: `lobby {players}`, `leaderboard {top: [...], solved, total}`, `ticker {text}`. Server→all: `round_start {level, ends_at}`, `round_end`.
Server→player: `welcome {player_id, status}`, `your_case {case_id}`. Host→server: `start {level, seconds}`, `end`.

---

## 11. Priorities (cut from the bottom if time runs short)
1. **Must:** case engine, tools, scoring, API, notebooks, Title/Office/Investigation/Board/Verdict/Reveal UI
2. **Should:** sound + juice pass, Class Mode, Class Autopsy
3. **Could:** Detective Profiles, Hacker Mode, PDF report, Adaptive endless mode
