# THE AUDITOR: TODO

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
- [ ] T14 · Next.js scaffold, design tokens, FX layer, sound, API client

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
- [ ] T20 · Sound, polish, reduced motion, phone layout

### M11 · Class Mode
- [x] T21 · Rooms backend + WebSocket
- [ ] T22 · Host projector + player phone pages

### M12 · Autopsy & Profiles
- [x] T23 · Class Autopsy analytics + KMeans detective profiles (+ notebook 03)
- [ ] T24 · Autopsy slide deck + detective trading card

## 🟨 COULD

### M13 · Extras
- [ ] T25 · Hacker Mode (Python in the browser via Pyodide)
- [ ] T26 · Case report PDF + adaptive endless mode

## 🚀 SHIP

### M14 · Ship & Demo
- [ ] T27 · Deploy, 200-player load test, README, demo script
