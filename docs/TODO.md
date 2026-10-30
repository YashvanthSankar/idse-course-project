# OUTLIER: TODO

Tick a box when a task is done. Full details for each task are in [PLAN.md](PLAN.md); the game design is in [DESIGN.md](DESIGN.md).

## 🟥 MUST

### M1 · Case Engine (Python)
- [x] T1 · Backend scaffold + shared models
- [x] T2 · Honest transaction generator
- [x] T3 · 6 fraud schemes + red herrings (CEO, Diwali)
- [x] T4 · Level catalog + `build_case`

### M2 · Detective Tools (Python)
- [x] T5 · Tool framework, noir chart theme, Summary + Pattern Matrix
- [x] T6 · Z-Score, Box Plot, Twin Finder (duplicates)
- [x] T7 · Benford's Law, Timeline
- [x] T8 · Margin Regression, IsolationForest
- [x] T9 · Fairness tests (every level is solvable, honest data stays quiet)

### M3 · Game Rules
- [x] T10 · Scoring + Adaptive Fraudster

### M4 · API
- [x] T11 · Case sessions + tool routes (budget, locks, no answer leaks)
- [x] T12 · Accuse + telemetry + debug truth

### M5 · Notebooks (graded proof)
- [x] T13 · `01_case_generator` + `02_detection_tools` notebooks

### M6 · Frontend Foundation
- [x] T14 · Next.js scaffold, design tokens, FX layer, sound, API client

### M7 · Title & Office
- [x] T15 · Title screen, office desk, briefing memo

### M8 · Investigation Screen
- [x] T16 · Suspects, Tool Kit, results, budget meter, timer
- [x] T17 · Data table + "Under the hood" code drawer

### M9 · Board, Accuse, Verdict
- [x] T18 · Corkboard with red string
- [x] T19 · Spotlight accusation, GUILTY stamp, reveal

## 🟧 SHOULD

### M10 · Juice & Mobile
- [x] T20 · Sound, polish, reduced motion, phone layout

### M11 · Class Mode
- [x] T21 · Rooms backend + WebSocket
- [x] T22 · Host projector + player phone pages

### M12 · Autopsy & Profiles
- [x] T23 · Class Autopsy analytics + KMeans detective profiles (+ notebook 03)
- [x] T24 · Autopsy slide deck + detective trading card

## 🟨 COULD

### M13 · Extras
- [x] T25 · Hacker Mode (Python in the browser via Pyodide)
- [x] T26 · Case report PDF + adaptive endless mode

## 🚀 SHIP

### M14 · Ship & Demo
- [x] T27a · 200-player load test, Dockerfile + Fly.io config, README, demo script
- [x] T27b · Live: game at otlr.vercel.app (Vercel), Python backend on the yash-micro VPS (systemd + Caddy HTTPS, Neon Postgres telemetry)

## 🧠 BRAIN MODE

### M15 · Tighter budget (no clock, so students can think)
- [x] T28 · Tighter budgets (5·5·6·7·7·9·10) that never cover every tool, +40 per unused coin, no time bonus
- [x] T29 · Budget-first briefing and manual, timer removed from the case HUD, visible ← back buttons on every screen

## 🕵️ CAREER EVIDENCE

### M16 · Prove the case (branch `career-evidence`, not merged yet)
- [x] T30 · New case rating: Verdict 35 · Theory 10 · Proof 10 · Exhibits 25 · Spending 20 (replaces Evidence / Tool judgment / Efficiency)
- [x] T31 · Accuse with a theory (the trick), 1–2 clues and 1–5 exhibit rows from the accused's ledger; a clue from a tool that fits the theory proves it, anything else is a lead unless a second tool agrees
- [x] T32 · Exceptional bar per tier (88 small/mid · 92 large · 90 very large), free cross-check slack (2 · 2 · 1), three Good years at one large firm count as one Exceptional, Box & Whisker is the intended tool for big invoices
- [x] T33 · Seniors hand over notes on day one (shorter as you climb, none in the Final); Case File and ledger row picker in the spotlight; verdict screen, Manual and tool cards updated
- [x] T34 · Bug: can't move from case 1 to case 2 in a contract (main reloads case 1 over case 2 from the verdict screen; fixed on the branch, e2e checks it)
- [x] T35 · Bug: tapping a row in the ledger picker filtered by the value under your finger instead of pinning it, hiding the other fraud rows; the row now pins wherever you tap and only the 🔍 filters
- [x] T36 · All 3 career e2e tests passing; full backend suite (350) passing; old saved careers still load
- [ ] T37 · CAREER.md §3.1 / §3.2 rewritten for the new rating, new §7.7 Seniors; CAREER_HANDOVER.md updated
- [x] T38 · Calibrate with bots (`backend/scripts/calibrate_career.py`). A sharp bot reaches Exceptional 100% small · 87% mid · 40% large · ~20% very large. The bar barely matters: solving the hard case decides it, so Large hard cases now get 1 spare coin instead of 2 (was 70%)
- [x] T39 · Commit the branch and merge to main
- [ ] T40 · Deploy the backend (VPS) and the frontend (Vercel) together: the career accusation request changed (theory + exhibits), so one without the other breaks accusations
- [ ] T41 · Very large comes out at ~20% Exceptional (target 30–40%): the two-fraudster case is solved too rarely. Decide whether to loosen it (more spare coins on very hard) or keep it

## 🛡️ CAREER HARDENING

### M17 · Review fixes before the class plays it (verified locally, not deployed yet)
- [x] T42 · Career saves go to a background writer: no request waits on the database, failed writes retry, a graceful restart flushes (200 students at once on a 1 s database: 8.7 s instead of 22.8 s, all 360 saves landed)
- [x] T43 · Every change is made on a copy under the career's lock and swapped in whole; a case from an old contract, a closed case or a retired career can't be scored
- [x] T44 · A hidden salt per career: fraudsters, seeds and the Final's culprit can't be worked out from the visible code
- [x] T45 · Retire is idempotent; creating careers and guessing codes are rate-limited (only unknown codes count, so a class behind one Wi-Fi is fine); accusation strings are capped
- [x] T46 · Live cases are bounded by ledger rows (~0.8 KB each, 400k ≈ 350 MB); solved cases expire after 30 min and are evicted first
- [x] T47 · Interrogating the Final's 10 suspects works; both fraudsters lie about their own trick; the draw can't be replayed offline
- [x] T48 · Rating: Spending needs a clue that points at the accused (no analysis can't be Exceptional); a twin's original and the fraudster's own weekend rows are fair exhibits; one-culprit proof needs a clue naming one person
- [x] T49 · "What catches it" comes from the theories; firing resets every promotion streak (CAREER.md §5); a tricks list that fails to load says so; the row picker shows the amount on phones
- [x] T50 · The live frontend (d2a6192) passes all its e2e tests against the new backend: deploy the backend first, then Vercel
