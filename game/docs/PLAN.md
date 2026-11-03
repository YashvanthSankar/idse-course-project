# OUTLIER Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a noir detective web game in which players catch fraudsters with real Python data analysis, including a live 200-player Class Mode and a Class Autopsy that analyzes the class's own play data.

**Architecture:** A Python package `auditor` (numpy/pandas/scipy/scikit-learn/plotly) generates cases, runs detection tools, scores accusations and analyzes telemetry. FastAPI serves it over REST plus WebSockets (one worker, in-memory sessions, SQLite telemetry). A Next.js frontend renders the game. It never computes statistics: charts arrive as Plotly JSON built in Python.

**Tech Stack:** Python 3.12 (uv), FastAPI, pydantic v2, numpy, pandas, scipy, scikit-learn, plotly, seaborn/matplotlib, pytest, ruff · Next.js (App Router, TypeScript strict), Tailwind CSS v4, shadcn/ui, Framer Motion, Zustand, TanStack Query/Table/Virtual, react-plotly.js, dnd-kit, Howler.js, Shiki, qrcode.react, canvas-confetti, html-to-image, Pyodide, Vitest, Playwright.

**Spec:** `docs/DESIGN.md` (section references below, written §N, point to it)

## Global Constraints

- Python is pinned to **3.12** via `uv python pin 3.12`. The machine's 3.15 may lack scientific wheels.
- uvicorn runs with **exactly 1 worker** (sessions and rooms are in memory).
- No response before a verdict may contain `CaseTruth` fields (`fraudster_id`, `scheme`, `fraud_txn_ids`, `catching_tools`, `herrings`, `explanation`).
- The frontend never computes statistics. Every chart is a Python-built Plotly figure JSON rendered by `react-plotly.js`.
- `ToolResult.code` is always `inspect.getsource(tool.analyze)`.
- TypeScript API types are **generated** from FastAPI's OpenAPI (`pnpm gen:api` → `web/lib/api-types.ts`), never hand-written.
- Design tokens, fonts and the screen list are exactly as in §9. The game is dark only.
- All motion and FX are disabled under `prefers-reduced-motion: reduce`. Every sound respects the global mute.
- Randomness only comes from `np.random.default_rng(seed)` passed down explicitly. No global `np.random.*` calls.
- Lint gates: `uv run ruff check .` and `pnpm lint` are clean before each commit.

## Review Focus

1. **Cheating via DevTools:** a student inspects network responses or calls the API directly. Expect no truth leaks (Task 11), locked or over-budget tools refused server-side (Task 11), and the debug truth endpoint 404 unless `AUDITOR_DEBUG=1` (Task 12).
2. **Leaderboard farming:** repeating `POST /accuse` or re-submitting a different suspect. Expect the stored verdict back unchanged and the score counted once (Tasks 12, 21).
3. **Phone locks mid-round:** the WebSocket drops and the player rejoins. Expect the same `player_id` to keep its case_id, score and leaderboard row with no duplicate entry (Task 21).
4. **Hacker Mode infinite loop:** `while True: pass` must not freeze the game. Expect Pyodide to run in a Web Worker that is terminated after 5 s, showing "Timed out", with the UI staying responsive (Task 25).
5. **200 simultaneous joins on campus Wi-Fi:** expect all players in the lobby, `round_start` reaching everyone within 2 s and memory under 512 MB (Task 27 load script).

---

## Module Overview (the team TODO list)

| Module | Tasks | Priority | Suggested owner |
|---|---|---|---|
| M1 Case Engine | 1–4 | Must | Data person A |
| M2 Detective Tools | 5–9 | Must | Data person A + B |
| M3 Game Rules | 10 | Must | Data person B |
| M4 API | 11–12 | Must | Backend person B |
| M5 Notebooks (graded proof) | 13 | Must | Data person A |
| M6 Frontend Foundation | 14 | Must | Frontend person C |
| M7 Title & Office | 15 | Must | Frontend person C |
| M8 Investigation Screen | 16–17 | Must | Frontend person C + D |
| M9 Board, Accuse, Verdict | 18–19 | Must | Frontend person D |
| M10 Juice & Mobile | 20 | Should | Frontend person D |
| M11 Class Mode | 21–22 | Should | Backend B + Frontend C |
| M12 Autopsy & Profiles | 23–24 | Should / Could | Data A + Frontend D |
| M13 Extras | 25–26 | Could | Whoever is ahead |
| M14 Ship & Demo | 27 | Must | Everyone |

**Critical path:** 1 → 4 → 5 → 9 → 11 → 12 → 14 → 16 → 19. The frontend can start Task 14 on day 1 against the spec's API contract (§10.1).

---

## File Structure

```
idse-game/
├── backend/
│   ├── pyproject.toml              # uv project, deps, ruff + pytest config
│   ├── auditor/
│   │   ├── models.py               # pydantic schemas + Literal ids (shared vocabulary)
│   │   ├── generator/
│   │   │   ├── base.py             # suspects + honest transactions
│   │   │   ├── schemes.py          # 6 fraud injectors + SCHEME_CATCHERS
│   │   │   ├── red_herrings.py     # ceo, diwali
│   │   │   └── cases.py            # LEVELS catalog, CaseBundle, build_case
│   │   ├── tools/
│   │   │   ├── base.py             # Analysis, Tool dataclasses
│   │   │   ├── summary.py groupby.py zscore.py iqr_box.py duplicates.py
│   │   │   ├── benford.py timeseries.py regression.py isoforest.py
│   │   │   └── registry.py         # TOOLS, run_tool, unlocked_tools
│   │   ├── charts.py               # "noir" Plotly template, fig_to_json
│   │   ├── scoring.py              # grade_evidence, score_accusation
│   │   ├── adapt.py                # pick_scheme
│   │   ├── store.py                # CaseSession, SessionStore (LRU)
│   │   ├── telemetry.py            # SQLite event log → pandas
│   │   ├── rooms.py                # Class Mode room state
│   │   ├── autopsy.py              # class analytics slides
│   │   ├── profiles.py             # KMeans archetypes
│   │   ├── report.py               # seaborn PDF
│   │   └── api.py                  # create_app(), routes, WS
│   ├── tests/                      # one test file per module
│   ├── scripts/load_test.py        # 200 WS clients
│   └── Dockerfile
├── notebooks/
│   ├── 01_case_generator.ipynb
│   ├── 02_detection_tools.ipynb
│   └── 03_class_autopsy.ipynb
└── web/
    ├── app/                        # routes from §9.4
    │   ├── layout.tsx page.tsx office/ case/[caseId]/ host/ host/[code]/ host/[code]/autopsy/
    │   └── play/[code]/ profile/[playerId]/
    ├── components/
    │   ├── fx/       FilmGrain Vignette Rain LampLight Typewriter Stamp useShake
    │   ├── case/     SuspectRail SuspectCard ToolKit ToolCard ResultPanel PlotlyChart TerminalRun
    │   │             BudgetMeter CaseTimer DataTable CodeDrawer BriefingModal
    │   ├── board/    Corkboard EvidencePolaroid RedString
    │   ├── accuse/   Spotlight HoldToConfirm
    │   ├── verdict/  VerdictStamp ScoreCounter RevealReplay
    │   ├── host/     RoomCode JoinQR NameChips Leaderboard Ticker CountdownRing Podium
    │   ├── autopsy/  SlideDeck
    │   ├── profile/  DetectiveCard
    │   └── hacker/   HackerConsole
    ├── lib/          api.ts api-types.ts(generated) store.ts sound.ts ws.ts pyodide.worker.ts format.ts
    ├── public/       sfx/ (+CREDITS.md) portraits/ textures/
    └── e2e/          Playwright specs
```

---

# M1: Case Engine

### Task 1: Backend scaffold + shared models

**Files:**
- Create: `backend/pyproject.toml`, `backend/auditor/__init__.py`, `backend/auditor/models.py`, `backend/tests/test_models.py`, `.gitignore`

**Interfaces:**
- Produces (in `auditor/models.py`):
  - `SchemeId = Literal["big_invoice","duplicates","fabricated","weekend","inflated_ratio","under_limit"]`
  - `ToolId = Literal["summary","groupby","zscore","iqr_box","duplicates","benford","timeseries","regression","isoforest"]`
  - `HerringId = Literal["ceo","diwali"]`
  - `Suspect(id, name, role, department, bio, portrait: str)`
  - `CaseMeta(case_id: str, level: int, title: str, briefing: str, budget: int, budget_left: int, suspects: list[Suspect], columns: list[str], n_rows: int, unlocked_tools: list[ToolId])`
  - `CaseTruth(fraudster_id: str | None, scheme: SchemeId | None, fraud_txn_ids: list[str], catching_tools: list[ToolId], herrings: list[HerringId], explanation: str)`
  - `ToolSpec(id: ToolId, name: str, cost: int, unlock_level: int, params: dict[str, list[str] | float], visual: bool)`
  - `ToolResult(result_id: str, tool_id: ToolId, params: dict, title: str, summary: str, figure: dict, table: list[dict] | None, code: str, stats: dict[str, float | str], implicates: list[str], cost_charged: int, budget_left: int)`
  - `Accusation(suspect_id: str, evidence_ids: list[str] = Field(min_length=2, max_length=2))`
  - `EvidenceGrade(result_id: str, tool_id: ToolId, grade: Literal["strong","supportive","weak","irrelevant"], points: int)`
  - `Verdict(correct: bool, score: int, breakdown: dict[str, int], fraudster: Suspect, scheme: SchemeId, explanation: str, fraud_txn_ids: list[str], catching_tools: list[ToolId], evidence: list[EvidenceGrade])`

- [ ] **Step 1: Scaffold.** Run `cd backend && uv init --lib --name auditor && uv python pin 3.12 && uv add fastapi "uvicorn[standard]" pydantic numpy pandas scipy scikit-learn plotly seaborn matplotlib && uv add --dev pytest ruff httpx jupyter nbconvert`. Configure `[tool.pytest.ini_options] markers = ["slow"]` and ruff `line-length = 100`. Add `.gitignore` entries: `.venv`, `__pycache__`, `*.db`, `node_modules`, `.next`.
- [ ] **Step 2: Write failing tests** in `tests/test_models.py`:
  - `test_accusation_requires_exactly_two_evidence`: `Accusation(suspect_id="E1", evidence_ids=["a"])` raises `ValidationError`, and so do 3 ids.
  - `test_case_meta_has_no_truth_fields`: `set(CaseMeta.model_fields).isdisjoint({"fraudster_id","scheme","fraud_txn_ids","catching_tools","herrings","explanation"})`.
- [ ] **Step 3: Run** `uv run pytest tests/test_models.py -v`. Expected: FAIL (import error).
- [ ] **Step 4: Implement** `auditor/models.py` with the Interfaces above.
- [ ] **Step 5: Run** `uv run pytest -v`. Expected: PASS.
- [ ] **Step 6: Commit** `git add backend .gitignore && git commit -m "feat(backend): scaffold auditor package and shared models"`

### Task 2: Honest baseline generator

**Files:**
- Create: `backend/auditor/generator/__init__.py`, `backend/auditor/generator/base.py`, `backend/tests/test_generator_base.py`

**Interfaces:**
- Consumes: `Suspect` (Task 1)
- Produces:
  - `SUSPECT_POOL: list[dict]` (≥ 14 entries: name, role, department, bio, portrait), plus `CEO: dict` (role "CEO")
  - `CATEGORY_PROFILES: dict[str, tuple[float, float]]` mapping category → (median INR, sigma of ln). Roughly chai_snacks 120, cab 450, client_meal 2,500, hotel 6,500, flight 14,000, equipment 38,000, each with sigma ≈ 0.45
  - `make_suspects(rng: np.random.Generator, include_ceo: bool, n: int = 5) -> list[Suspect]` (ids `E1`…`E5`; the CEO, if included, is one of them)
  - `make_honest_transactions(rng, suspects: list[Suspect], n_rows: int = 1000, start: date = date(2026, 7, 1)) -> pd.DataFrame` with exactly the columns in §3 (`festival_bonus` is not produced here). The CEO's amounts are ×4.

- [ ] **Step 1: Write failing tests:**
  - `test_columns_exact`: `list(df.columns) == ["txn_id","date","hour","employee_id","vendor","category","amount","revenue","invoice_id"]`
  - `test_deterministic`: two calls with `default_rng(7)` give `pd.testing.assert_frame_equal`
  - `test_weekend_share_low`: share of rows with `date.weekday() >= 5` is ≤ 0.03
  - `test_hours_mostly_office`: share of rows with `9 <= hour <= 20` is ≥ 0.95
  - `test_honest_data_is_benford_like`: over all rows, mean absolute deviation of first-digit frequencies from `log10(1+1/d)` is < 0.015
  - `test_invoice_ids_unique`, `test_amounts_positive`, `test_revenue_ratio`: median of `amount/revenue` is in [0.04, 0.06]
- [ ] **Step 2: Run** `uv run pytest tests/test_generator_base.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement.** Pick a category per row with fixed weights, draw `amount = median * exp(rng.normal(0, sigma))` rounded to 2 dp, and draw `revenue = amount / exp(rng.normal(ln 0.05, 0.3))`. Dates are business days uniform over 90 days, with weekend rows at ~2% (on-call). Hours come from `rng.normal(14, 2.5)` clipped to 9–20. Each employee uses a few favourite vendors (weighted choice from 25 names).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(generator): honest transaction baseline"`

### Task 3: Fraud schemes + red herrings

**Files:**
- Create: `backend/auditor/generator/schemes.py`, `backend/auditor/generator/red_herrings.py`, `backend/tests/test_schemes.py`

**Interfaces:**
- Produces:
  - `inject(scheme: SchemeId, df: pd.DataFrame, fraudster_id: str, rng) -> tuple[pd.DataFrame, list[str]]` returns a new df plus the fraud `txn_id`s (it never mutates its input)
  - `SCHEME_CATCHERS: dict[SchemeId, list[ToolId]]`, copied from §4 "Catching tools"
  - `SCHEME_EXPLANATIONS: dict[SchemeId, str]`, one or two noir sentences each, used in the Reveal
  - `add_herring(herring: HerringId, df, suspects: list[Suspect], rng) -> pd.DataFrame`. `diwali` adds one `festival_bonus` row per suspect (15,000–40,000) within a single week. `ceo` is a no-op here (the ×4 is in the base), kept for symmetry.

- [ ] **Step 1: Write failing tests** (parametrized over all 6 schemes where marked):
  - `test_inject_only_touches_fraudster` (all schemes): every returned fraud txn has `employee_id == fraudster_id`, and non-fraud rows of other employees are unchanged
  - `test_inject_does_not_mutate_input` (all schemes)
  - `test_big_invoice_magnitude`: 1–2 fraud rows, each ≥ 8× the fraudster's median for that category
  - `test_duplicates_twins`: ≥ 6 fraud rows, each matching an earlier row's (vendor, amount) 1–3 days before, with a new `invoice_id`
  - `test_fabricated_digits_flat`: ≥ 55 fraud rows with 1,000 ≤ amount < 10,000, and first-digit counts roughly uniform (every digit ≥ 3)
  - `test_weekend_rows`: ≥ 12 fraud rows, all with weekday ≥ 5
  - `test_inflated_ratio`: ≥ 25 fraud rows, with median `amount/revenue` ≥ 1.6 × the honest median
  - `test_under_limit`: 10–14 rows, amounts in [45,000, 49,999], hour in [1, 4], and a vendor that appears only in fraud rows
  - `test_diwali_herring`: exactly one `festival_bonus` row per suspect, all dates within a 7-day span
- [ ] **Step 2: Run** `uv run pytest tests/test_schemes.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** one private injector per scheme with `inject` dispatching on the id. Schemes that add rows (duplicates, fabricated, weekend, under_limit) assign fresh `txn_id`s continuing the sequence. `inflated_ratio` and `big_invoice` modify existing fraudster rows.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(generator): fraud schemes and red herrings"`

### Task 4: Level catalog + `build_case`

**Files:**
- Create: `backend/auditor/generator/cases.py`, `backend/tests/test_cases.py`

**Interfaces:**
- Consumes: Tasks 2–3
- Produces:
  - `@dataclass(frozen=True) LevelSpec(level: int, title: str, briefing: str, scheme: SchemeId | None, budget: int, herrings: tuple[HerringId, ...], unlocks: tuple[ToolId, ...])`
  - `LEVELS: dict[int, LevelSpec]` for levels 1–7 exactly per §4. Level 7 has `scheme=None` and herrings chosen by rng.
  - `@dataclass CaseBundle(meta: CaseMeta, df: pd.DataFrame, truth: CaseTruth)`
  - `build_case(level: int, seed: int, scheme_override: SchemeId | None = None, case_id: str | None = None) -> CaseBundle`. The fraudster is a random non-CEO suspect. The df is sorted by date then hour, and `txn_id`s are re-numbered after sorting (fraud ids remapped accordingly).
  - `build_honest_case(seed: int) -> CaseBundle` with `truth.fraudster_id=None, scheme=None`
  - `unlocked_until(level: int) -> list[ToolId]` returns the union of `unlocks` for levels ≤ level, in tool order

- [ ] **Step 1: Write failing tests:**
  - `test_build_case_deterministic`: `build_case(3, 42)` twice gives equal df and truth (property P3, §5)
  - `test_level_table_matches_spec`: `[LEVELS[i].budget for i in range(1, 8)] == [8, 8, 10, 10, 12, 14, 14]`, and level 3's scheme is `"fabricated"`
  - `test_ceo_suspect_when_herring`: `build_case(1, s)` always includes a suspect with role "CEO" who is never the fraudster (seeds 0–19)
  - `test_truth_ids_exist_in_df`: every `fraud_txn_ids` entry is in `df.txn_id`
  - `test_meta_unlocked_tools`: `build_case(3, 0).meta.unlocked_tools == ["summary","groupby","zscore","iqr_box","duplicates","benford"]`
  - `test_level7_uses_override`: `build_case(7, 1, scheme_override="weekend").truth.scheme == "weekend"`
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** `rng = np.random.default_rng(seed)` is created once and passed down. Write the briefing text in the Chief's voice, with each briefing hinting at the technique without naming it.
- [ ] **Step 4: Run** `uv run pytest -v`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(generator): level catalog and build_case"`

---

# M2: Detective Tools

### Task 5: Tool framework, noir chart theme, `summary` + `groupby`

**Files:**
- Create: `backend/auditor/tools/__init__.py`, `tools/base.py`, `tools/summary.py`, `tools/groupby.py`, `tools/registry.py`, `backend/auditor/charts.py`, `backend/tests/test_tools_basic.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) Analysis(title: str, summary: str, stats: dict[str, float | str], implicates: list[str], table: pd.DataFrame | None, plot_data: dict)`
  - `@dataclass(frozen=True) Tool(id: ToolId, name: str, cost: int, unlock_level: int, params: dict[str, list[str] | float], visual: bool, analyze: Callable[..., Analysis], chart: Callable[[Analysis], go.Figure])`
  - `charts.COLORS: dict[str, str]` (the §9.1 hex values), `charts.register_noir_template() -> None` (idempotent, sets `pio.templates.default = "noir"`), `charts.fig_to_json(fig) -> dict`
  - `registry.TOOLS: dict[ToolId, Tool]`, `registry.tool_specs(level: int) -> list[ToolSpec]`, `registry.run_tool(tool_id: ToolId, df: pd.DataFrame, params: dict) -> tuple[Analysis, dict, str]` returning (analysis, figure_json, code). It raises `ValueError` for unknown params or values.
  - Each tool module exposes `analyze(df, **params) -> Analysis`, `chart(a: Analysis) -> go.Figure` and `TOOL: Tool`

- [ ] **Step 1: Write failing tests:**
  - `test_registry_costs_match_spec`: with `SPEC_COSTS = {"summary":1,"groupby":1,"zscore":2,"iqr_box":2,"duplicates":2,"benford":3,"timeseries":3,"regression":4,"isoforest":5}`, every registered tool satisfies `TOOLS[t].cost == SPEC_COSTS[t]` (Task 8's `test_registry_complete` later asserts all 9 are present)
  - `test_code_is_real_source`: `run_tool("summary", df, {})[2] == inspect.getsource(summary.analyze)`
  - `test_summary_implicates_nobody`
  - `test_groupby_weekday_catches_weekend_fraud`: on `build_case(4, 0).df`, `groupby(by="weekday")` implicates the fraudster
  - `test_groupby_rejects_bad_param`: `run_tool("groupby", df, {"by": "colour"})` raises `ValueError`
  - `test_figure_uses_noir_template`: the returned figure JSON's `layout.paper_bgcolor` is `"rgba(0,0,0,0)"`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** For `groupby`, crosstab employee × `by`, then for each employee run `scipy.stats.chi2_contingency` on a 2×k table [that employee's row, everyone else's summed row]. Bucket hours as `night (0-5) / morning / afternoon / evening`. For the chart: a Plotly heatmap with the implicated rows labelled in red.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(tools): framework, noir theme, summary and groupby"`

### Task 6: `zscore`, `iqr_box`, `duplicates`

**Files:**
- Create: `tools/zscore.py`, `tools/iqr_box.py`, `tools/duplicates.py`, `tests/test_tools_outliers.py`
- Modify: `tools/registry.py` (register them)

**Interfaces:** all three follow Task 5's module contract. Params: `zscore`: `scope ∈ ["global","per_employee"]`, `threshold` default 3.0. The others take none.

- [ ] **Step 1: Write failing tests:**
  - `test_zscore_per_employee_catches_big_invoice`: `build_case(1, 0)` with per_employee implicates exactly `[fraudster]`
  - `test_zscore_global_flags_ceo`: global scope on `build_case(1, 0)` implicates the CEO (this is the red-herring lesson)
  - `test_iqr_box_catches_big_invoice`
  - `test_duplicates_catches_twins`: `build_case(2, 0)` implicates `[fraudster]`, and `stats["twin_pairs"] >= 6`
  - `test_duplicates_table_lists_pairs`: the table has columns `["employee_id","vendor","amount","date_a","date_b"]`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** For z, use `log10(amount)`, with `groupby(["employee_id","category"]).transform` for per_employee. For twins, self-merge on (employee_id, vendor, amount) keeping `0 < Δdays ≤ 7`. Charts: a strip plot of z with threshold lines, a box plot per employee, and a timeline of twin pairs joined by lines.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(tools): z-score, box plot and duplicate detection"`

### Task 7: `benford`, `timeseries`

**Files:**
- Create: `tools/benford.py`, `tools/timeseries.py`, `tests/test_tools_patterns.py`
- Modify: `tools/registry.py`

**Interfaces:** Task 5 contract. Params: `timeseries.freq ∈ ["D","W"]`.

- [ ] **Step 1: Write failing tests:**
  - `test_benford_catches_fabricated`: `build_case(3, 0)` implicates `[fraudster]`, with `stats[f"p_{fraudster}"] < 0.001`
  - `test_benford_small_sample_inconclusive`: on a df where one employee has 30 rows, `stats[f"verdict_{eid}"] == "inconclusive"` and they are not in `implicates`
  - `test_benford_expected_curve`: `plot_data["expected"]` ≈ `np.log10(1 + 1/np.arange(1, 10))` (atol 1e-9)
  - `test_timeseries_catches_weekend`: `build_case(4, 0)` implicates `[fraudster]`
  - `test_timeseries_ignores_diwali`: the Diwali-bonus rows do not implicate everyone (the weekend rule only)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** For Benford, take the first digit from `amount` with `(amount / 10**floor(log10(amount))).astype(int)`, then `scipy.stats.chisquare(observed_counts, expected_props * n)`. Chart: grouped bars per employee vs. the expected line in amber. Timeseries: a `resample(freq)` line per employee with weekend vrects shaded.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(tools): Benford's law and timeline"`

### Task 8: `regression`, `isoforest`

**Files:**
- Create: `tools/regression.py`, `tools/isoforest.py`, `tests/test_tools_models.py`
- Modify: `tools/registry.py`

- [ ] **Step 1: Write failing tests:**
  - `test_regression_catches_inflated`: `build_case(5, 0)` implicates `[fraudster]`, and `stats["r2"]` is in (0, 1)
  - `test_regression_line_in_plot_data`: `plot_data` has `slope` and `intercept` that match `np.polyfit(log revenue, log amount, 1)` to 1e-6
  - `test_isoforest_catches_ghost_vendor`: `build_case(6, 0)` implicates `[fraudster]`
  - `test_isoforest_deterministic`: two runs give identical `implicates` and stats
  - `test_registry_complete`: `len(TOOLS) == 9` and all costs match §5
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Regression uses `sklearn.linear_model.LinearRegression` on logs, standardized residuals and `scipy.stats.ttest_1samp(resid_e, 0, alternative="greater")`. Chart: a scatter with the fit line, fraudster points in red. IsolationForest features: `log10(amount)`, `hour`, `vendor_freq = vendor.map(vendor.value_counts(normalize=True))` and `near_limit = (45000 <= amount < 50000)`, with `contamination=0.02, random_state=0`. Chart: a 2D scatter (amount vs. hour) colored by anomaly score.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(tools): margin regression and IsolationForest"`

### Task 9: Fairness property suite (P1, P2)

**Files:**
- Create: `backend/tests/test_fairness.py`
- Modify (tuning only): `generator/base.py`, `generator/schemes.py` and the thresholds in tool modules, if properties fail

**Interfaces:** consumes `build_case`, `build_honest_case`, `run_tool`, `SCHEME_CATCHERS`.

- [ ] **Step 1: Write the tests** (mark `@pytest.mark.slow`):
  - `test_P1_catching_tools_find_fraudster[level]` for levels 1–6: for seeds 0–19 and each tool in `LEVELS[level]`'s catching tools (zscore with `scope="per_employee"`; groupby with the `by` that fits the scheme: weekend→`weekday`, under_limit→`vendor`), count seeds where `fraudster ∈ implicates and len(implicates) ≤ 2`. Assert ≥ 19 out of 20.
  - `test_P2_honest_cases_are_quiet[tool]` for all 9 tools with default params (zscore per_employee): over `build_honest_case(0..19)`, count seeds with `implicates == []`. Assert ≥ 18 out of 20.
- [ ] **Step 2: Run** `uv run pytest -m slow -v`. Read the failures and tune generator magnitudes and tool thresholds within §5's stated rules until everything passes. **Never** weaken a test's numbers.
- [ ] **Step 3: Commit** `git commit -am "test: fairness properties for every level and tool"`

---

# M3: Game Rules

### Task 10: Scoring + Adaptive Fraudster

**Files:**
- Create: `backend/auditor/scoring.py`, `backend/auditor/adapt.py`, `backend/tests/test_scoring.py`, `backend/tests/test_adapt.py`

**Interfaces:**
- Produces:
  - `grade_evidence(result: ToolResult, accused: str, catching_tools: list[ToolId]) -> EvidenceGrade` (rules in §2.1)
  - `score_accusation(truth: CaseTruth, suspects: list[Suspect], accused: str, evidence: list[ToolResult], budget_left: int, elapsed_s: int) -> Verdict`, where `breakdown` keys are `base, evidence, budget_bonus, time_bonus`
  - `pick_scheme(profile: Counter[str], rng: np.random.Generator) -> SchemeId`

- [ ] **Step 1: Write failing tests:**
  - `test_perfect_score`: correct, two strong items, budget_left 4, elapsed 100 → `score == 1830`, `breakdown == {"base":1000,"evidence":500,"budget_bonus":80,"time_bonus":250}`
  - `test_wrong_suspect_scores_zero`: score is 0, and the verdict still carries the fraudster and explanation
  - `test_grades`: one test each for strong (+250), supportive (+100), weak (0, three implicated) and irrelevant (−100)
  - `test_time_bonus_floor`: elapsed 900 → `time_bonus == 0`
  - `test_score_never_negative`: correct + two irrelevant items + budget 0 + elapsed 900 → `score == 800`, and a forced case summing below 0 clamps to 0
  - `test_adapt_avoids_top_tools`: a profile of `{"zscore": 9, "iqr_box": 7, "benford": 1}` never returns `"big_invoice"` across 50 rng seeds
  - `test_adapt_falls_back_when_everything_known`: a profile using every tool equally still returns a valid `SchemeId`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** per §2.1 and §6.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: scoring rules and adaptive fraudster"`

---

# M4: API

### Task 11: Sessions + case and tool routes

**Files:**
- Create: `backend/auditor/store.py`, `backend/auditor/api.py`, `backend/tests/test_api_cases.py`

**Interfaces:**
- Consumes: `build_case`, `run_tool`, `tool_specs`, `unlocked_until`
- Produces:
  - `@dataclass CaseSession(bundle: CaseBundle, budget_left: int, started_at: float, player_id: str | None, room_code: str | None, results: dict[str, ToolResult], cache: dict[tuple, str], verdict: Verdict | None = None)`
  - `SessionStore(max_size: int = 2000)` with `.create(session) -> str` (case_id = `uuid4().hex[:12]`), `.get(case_id) -> CaseSession` (raises `KeyError`) and LRU eviction
  - `create_app(store: SessionStore | None = None, clock: Callable[[], float] = time.monotonic) -> FastAPI`, plus a module-level `app = create_app()`. Task 12 adds the `telemetry` parameter.
  - The routes from §10.1: `POST /api/cases`, `GET /api/cases/{id}/rows`, `GET /api/cases/{id}/data.csv`, `GET /api/tools`, `POST /api/cases/{id}/tools/{tool_id}`, `POST /api/cases/{id}/hacker-charge`. CORS allows `WEB_ORIGIN` (env, default `http://localhost:3000`).

- [ ] **Step 1: Write failing tests** (using `fastapi.testclient.TestClient`):
  - `test_create_case_returns_meta`: `POST /api/cases {"level":1,"seed":3}` → 200, `budget_left == 8`, 5 suspects
  - `test_rows_paging`: `offset=0&limit=50` → 50 rows, and `total == n_rows`
  - `test_tool_run_charges_budget`: running zscore → `cost_charged == 2`, `budget_left == 6`
  - `test_cached_rerun_is_free`: the same tool and params again → `cost_charged == 0` and the same `result_id`
  - `test_over_budget_409`: spend down to 1, then benford → 409 with `{"detail": "Out of budget"}`
  - `test_locked_tool_403`: on level 1, `POST .../tools/benford` → 403
  - `test_bad_params_422`
  - `test_no_truth_leak` (Review Focus 1): serialize every response from create, rows, csv, tools and a tool run, and assert none contains the strings `"fraudster_id"`, `"fraud_txn_ids"`, `"catching_tools"`, `"is_fraud"` or the scheme name
  - `test_hacker_charge`: deducts 1 and returns 409 at 0
  - `test_unknown_case_404`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use `seed` from the body or `secrets.randbelow(2**31)`. Map `KeyError` → 404, `ValueError` → 422. The cache key is `(tool_id, tuple(sorted(params.items())))`.
- [ ] **Step 4: Run tests.** Expected: PASS. Also run `uv run uvicorn auditor.api:app --reload` and open `http://localhost:8000/docs`; all routes should be listed.
- [ ] **Step 5: Commit** `git commit -am "feat(api): case sessions and tool routes"`

### Task 12: Accuse, telemetry, debug truth

**Files:**
- Create: `backend/auditor/telemetry.py`, `backend/tests/test_api_accuse.py`, `backend/tests/test_telemetry.py`
- Modify: `backend/auditor/api.py` (signature becomes `create_app(store=None, telemetry: Telemetry | None = None, clock=time.monotonic)`)

**Interfaces:**
- Produces:
  - `Telemetry(path: str = os.getenv("AUDITOR_DB", "auditor.db"))` with `.log(event_type: Literal["case_started","tool_run","hacker_query","accused"], *, player_id: str | None, case_id: str, room_code: str | None = None, tool_id: str | None = None, payload: dict | None = None) -> None` and `.events_df(room_code: str | None = None) -> pd.DataFrame` (columns `ts, type, player_id, case_id, room_code, tool_id, payload` with payload parsed into a dict)
  - `POST /api/cases/{id}/accuse` (`Accusation` → `Verdict`)
  - `GET /api/debug/cases/{id}/truth` (only when `AUDITOR_DEBUG=1`)
  - A hook `on_verdict: list[Callable[[CaseSession, Verdict], None]]` on the app state, used by Rooms in Task 21

- [ ] **Step 1: Write failing tests:**
  - `test_accuse_correct_flow`: use the debug truth to accuse correctly with two strong items → `correct` and `score > 1000`
  - `test_accuse_idempotent` (Review Focus 2): a second call with a *different* suspect returns the identical first verdict
  - `test_accuse_unknown_evidence_422`, `test_accuse_duplicate_evidence_422` (the same id twice)
  - `test_accuse_with_hacker_note_impossible`: hacker charges create no result_ids (an unknown id → 422)
  - `test_debug_truth_hidden_by_default` → 404 without the env var
  - `test_events_logged`: create, two tool runs and an accuse → `events_df()["type"].tolist() == ["case_started","tool_run","tool_run","accused"]`, and the accused payload has `correct, score, budget_left, elapsed_s`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** using `sqlite3` with a single table, `check_same_thread=False` and a `threading.Lock`. `events_df` uses `pd.read_sql`.
- [ ] **Step 4: Run** `uv run pytest -v`. Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(api): accusations, telemetry and debug truth"`

---

# M5: Notebooks (graded proof)

### Task 13: Three narrated notebooks

**Files:**
- Create: `notebooks/01_case_generator.ipynb`, `notebooks/02_detection_tools.ipynb`, `notebooks/03_class_autopsy.ipynb`

Each notebook imports `auditor` (run with `uv run --project backend jupyter lab`) and is written like a story: a markdown question, code, a chart and the takeaway.
- **01:** how honest data is shaped (lognormal per category, Benford emerges from the mixture), then each scheme injected and visualized with seaborn, followed by the red herrings.
- **02:** each tool walked through by hand in plain pandas/numpy/scipy, then shown to equal `run_tool` output. Ends with the fairness results as a heatmap (level × tool detection rate over 20 seeds).
- **03:** a simulated class of 200 (synthetic telemetry) run through `autopsy.player_table` and the profiles. Completed after Task 23; until then, include a placeholder section.

- [ ] **Step 1:** Write 01 and 02.
- [ ] **Step 2: Verify** with `uv run --project backend jupyter nbconvert --to notebook --execute notebooks/0[12]*.ipynb --output-dir /tmp/nbcheck`. Expected: exit 0.
- [ ] **Step 3: Commit** `git add notebooks && git commit -m "docs: generator and detection notebooks"`

---

# M6: Frontend Foundation

### Task 14: Next.js scaffold, tokens, FX layer, sound, API client, store

**Files:**
- Create: `web/` via create-next-app, plus `web/app/globals.css` (tokens), `web/app/layout.tsx`, `web/components/fx/*`, `web/lib/{api.ts,api-types.ts,store.ts,sound.ts,format.ts}`, `web/lib/store.test.ts`, `web/e2e/smoke.spec.ts`, `web/playwright.config.ts`

**Interfaces:**
- Consumes: OpenAPI from Task 11 (`http://localhost:8000/openapi.json`)
- Produces:
  - `lib/api.ts`: typed functions `createCase(level, seed?)`, `getRows(caseId, offset, limit)`, `listTools(level)`, `runTool(caseId, toolId, params)`, `hackerCharge(caseId)`, `accuse(caseId, suspectId, evidenceIds)`. They throw `ApiError {status, detail}`. The base URL is `process.env.NEXT_PUBLIC_API_URL`.
  - `lib/store.ts`: a Zustand `useCaseStore` with `{meta, results: ToolResult[], activeResultId, pinned: string[], links: Record<resultId, suspectId>, verdict}` and actions `setMeta, addResult, setActive, pin, unpin, link(resultId, suspectId), unlink, setVerdict, reset`. The selector `evidenceFor(suspectId)` returns the linked result ids.
  - `lib/sound.ts`: `sfx.play(name: SfxName)`, `sfx.loop(name)`, `sfx.setVolume(v)`, `sfx.mute(bool)`, with mute and volume persisted in localStorage (try/catch). `SfxName` is the list in §9.3.
  - FX components: `<FilmGrain/> <Vignette/> <Rain density?/> <LampLight/> <Typewriter text speed onDone/> <Stamp kind="guilty"|"wrong"/>` and a `useShake()` hook. Each reads `useReducedMotion()` and renders statically when reduced.

- [ ] **Step 1: Scaffold.** Run `pnpm create next-app web --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*"`, then `pnpm dlx shadcn@latest init`, then `pnpm add framer-motion zustand @tanstack/react-query @tanstack/react-table @tanstack/react-virtual react-plotly.js plotly.js-dist-min @dnd-kit/core howler shiki qrcode.react canvas-confetti html-to-image` and `pnpm add -D openapi-typescript vitest @playwright/test @types/howler`. Add the scripts `"gen:api": "openapi-typescript http://localhost:8000/openapi.json -o lib/api-types.ts"` and `"test": "vitest run"`.
- [ ] **Step 2:** Put the §9.1 tokens into `globals.css` as CSS variables mapped into Tailwind `@theme`. Load the 4 fonts with `next/font/google` as CSS variables. The layout mounts FilmGrain, Vignette and the QueryClientProvider.
- [ ] **Step 3: Write failing tests:** `store.test.ts`: `link then evidenceFor returns ids`, `unpin also removes link`, `reset clears verdict`. `e2e/smoke.spec.ts`: `/` responds 200 and has a `<canvas>` (rain).
- [ ] **Step 4:** Run `pnpm test`. Expected: FAIL.
- [ ] **Step 5: Implement** the store, sound and FX. Rain is a canvas with `requestAnimationFrame` that stops on `document.hidden`.
- [ ] **Step 6:** Run `pnpm test && pnpm gen:api && pnpm build`. Expected: PASS and the build succeeds.
- [ ] **Step 7: Commit** `git add web && git commit -m "feat(web): scaffold, design tokens, FX layer, sound, API client"`

---

# M7: Title & Office

### Task 15: Title screen, Office desk, Briefing modal

**Files:**
- Create: `web/app/page.tsx`, `web/app/office/page.tsx`, `web/components/case/BriefingModal.tsx`, `web/components/title/{NeonSign,Skyline,Menu}.tsx`, `web/components/office/CaseFolder.tsx`, `web/e2e/title-office.spec.ts`
- Assets: `public/textures/{desk.jpg,cork.jpg,paper.png}` (CC0), `public/portraits/*.webp` (≥ 14, CC0 or team-made, falling back to an SVG silhouette with initials)

**Interfaces:** consumes `createCase`, `sfx`, FX components. Progress (unlocked level, best score per level) lives in localStorage under `auditor.progress.v1`, wrapped in try/catch.

Acceptance (visual, §9.4 screens 1–3):
- Title: a neon "OUTLIER" with CSS flicker keyframes, a skyline SVG parallax driven by pointer position (Framer `useMotionValue`), a typewritten menu, and rain + jazz starting on the first keypress or click.
- Office: folders laid out with a slight random rotation. Hover lifts them (spring, shadow) with a paper rustle. Locked folders have a red tape overlay and are not clickable. Each folder shows its best-score stamp.
- Clicking an unlocked folder calls `createCase(level)` → the Briefing modal (memo typewritten with key sounds, polaroids sliding in staggered) → "Open the files" navigates to `/case/{id}`.

- [ ] **Step 1: Write the failing e2e** `title-office.spec.ts`: `press key on title → office shows 7 folders → folders 2..7 locked → click folder 1 → briefing visible → click "Open the files" → URL matches /case/`.
- [ ] **Step 2:** Run `pnpm exec playwright test title-office`. Expected: FAIL.
- [ ] **Step 3: Implement** the screens.
- [ ] **Step 4:** Run the test. Expected: PASS. Also take a manual look at 1440×900 and 375×812.
- [ ] **Step 5: Commit** `git commit -am "feat(web): title screen, office and briefing"`

---

# M8: Investigation Screen

### Task 16: Suspects, Tool Kit, Result Panel, budget, timer

**Files:**
- Create: `web/app/case/[caseId]/page.tsx`, `web/components/case/{SuspectRail,SuspectCard,ToolKit,ToolCard,ResultPanel,PlotlyChart,TerminalRun,BudgetMeter,CaseTimer}.tsx`, `web/e2e/investigate.spec.ts`

**Interfaces:**
- Consumes: `runTool`, `listTools`, `useCaseStore`
- `PlotlyChart({figure}: {figure: object})` uses `next/dynamic` with `ssr:false`, `config={{displayModeBar:false, responsive:true}}`, and enables lasso/zoom/hover
- `TerminalRun({code, onDone})` streams `code` lines over ~800 ms (instant under reduced motion)

Acceptance (§9.4 screen 4):
- A 3-column desktop layout with the Tool Kit docked at the bottom. Below 768 px it becomes bottom tabs *Suspects / Tools / Result / Board*.
- Tool cards show an icon, name, cost coins and their params UI (a segmented control for `by`/`scope`/`freq`). Locked cards show "Unlocks at Case N". Keys 1–9 run tools.
- Running a tool shows TerminalRun → then the chart fades and scales in → a coin-drop sound and the meter animating down. A 409 shakes the meter and shows "Out of budget". Cached reruns show a "cached · free" badge.
- Result panel: title, a summary line (stats in JetBrains Mono), and the buttons **Pin as evidence** (pin sound) and **Under the hood** (Task 17). Implicated suspects get a red pulse on their card.
- The timer counts up from `meta`'s creation and its color shifts to amber after 5:00.

- [ ] **Step 1: Write the failing e2e** `investigate.spec.ts` (backend running, level 1): `run Z-Scan → chart svg visible → budget shows 6/8 → run Z-Scan again → "cached" badge and still 6/8 → press "Pin as evidence" → evidence tray has 1 item`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** the components.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(web): investigation screen with tool kit and results"`

### Task 17: Data table + Under the Hood drawer

**Files:**
- Create: `web/components/case/{DataTable,CodeDrawer}.tsx`, `web/e2e/data-code.spec.ts`

Acceptance:
- **Data** opens a virtualized table (TanStack Table + Virtual) of `getRows`, paged 200 at a time as you scroll, with column sort and an employee filter. Rows whose `employee_id` is implicated by the active result get a red left border.
- **Under the hood** slides up a bottom drawer (Framer, spring). Left: the Shiki-highlighted Python (`github-dark` theme, background overridden to `--ink-950`). Right: the stats as a key/value list. It has a copy button and closes with Esc.

- [ ] **Step 1: Write the failing e2e**: `open Data → 200+ rows render lazily (scroll loads more) → open Under the hood after Z-Scan → drawer contains "def analyze" → Esc closes`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(web): data table and under-the-hood code drawer"`

---

# M9: Corkboard, Accusation, Verdict

### Task 18: Corkboard with red string

**Files:**
- Create: `web/components/board/{Corkboard,EvidencePolaroid,RedString}.tsx`, `web/e2e/board.spec.ts`

Acceptance (§9.4 screen 5):
- A full-screen overlay (`B` toggles it) on the cork texture. Suspect polaroids are pinned along the top. Pinned evidence appears as polaroids showing a static chart thumbnail (Plotly `toImage` cached per result) and the tool name.
- Dragging (dnd-kit) evidence onto a suspect calls `link` and draws a red string: an SVG cubic path with a sag proportional to distance, animated via `pathLength` 0→1, with a string sound. Dropping on empty space unlinks it.
- A suspect with 2 linked items shows a glowing **Make the accusation** button. The board also works with touch (dnd-kit pointer + touch sensors).

- [ ] **Step 1: Write the failing e2e**: `pin 2 results → open board → drag each onto suspect E2 → two <path data-string> exist → "Make the accusation" visible`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): corkboard with draggable evidence and red string"`

### Task 19: Spotlight accusation, verdict stamp, reveal

**Files:**
- Create: `web/components/accuse/{Spotlight,HoldToConfirm}.tsx`, `web/components/verdict/{VerdictStamp,ScoreCounter,RevealReplay}.tsx`, `web/app/case/[caseId]/verdict/page.tsx`, `web/e2e/full-loop.spec.ts`

**Interfaces:** consumes `accuse()` and `useCaseStore.setVerdict`. The reveal figure is built in the frontend **only** by re-styling the case's Python figure: the backend adds `reveal_figure: dict` to `Verdict` (amend the Task 1 model and Task 12 route, then regenerate types). This is a scatter of all rows with the `fraud_txn_ids` in red, built in `auditor/charts.py`.

Acceptance (§9.4 screens 6–8):
- Spotlight: the background dims to 85% black with a radial mask on the suspect, a heartbeat loop and the suspect's line typed out. **HoldToConfirm** fills a ring over 1.5 s, and releasing early cancels.
- Verdict: the stamp scales 3 → 1 with rotation −12°, plus `useShake()` and a thud. ScoreCounter reveals breakdown lines at 400 ms intervals, counting up with ticks. Confetti only if correct.
- Reveal: fraud points light up one by one (Plotly `animate` or staggered marker color updates), followed by the explanation (typewriter), the catching tools as chips and an expandable code block.
- Saves the best score per level to progress and unlocks the next level when correct.

- [ ] **Step 1: Write the failing e2e** `full-loop.spec.ts` (backend with `AUDITOR_DEBUG=1`): read the debug truth, run the catching tool twice with different params (or two catching tools), pin both, link them to the fraudster, hold to accuse, then check that `GUILTY` is visible, the final score text is > 1000, and level 2 is unlocked in the office.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): accusation spotlight, verdict stamp and reveal"`

---

# M10: Juice & Mobile

### Task 20: Sound, polish, reduced motion, phone layout

**Files:**
- Modify: components from Tasks 15–19. Create `web/public/sfx/*` (CC0) + `web/public/sfx/CREDITS.md`, `web/components/settings/SettingsPanel.tsx`, `web/e2e/mobile-a11y.spec.ts`

Acceptance:
- Every sound in §9.3 is wired to its moment. The settings panel has volume, mute and a "reduce effects" toggle (forces reduced motion). Everything persists.
- Lamp light follows the pointer on the office and case screens. Screen transitions use a shared `AnimatePresence` page fade (200 ms).
- At 375×812 the full loop is playable with touch, and nothing scrolls horizontally.
- With `reducedMotion: "reduce"` there is no rain canvas animation, no shake and instant typewriter text.

- [ ] **Step 1: Write the failing e2e** `mobile-a11y.spec.ts`: rerun the full-loop steps at the iPhone 13 viewport, assert `document.documentElement.scrollWidth <= innerWidth`; with emulated reduced motion, assert the rain canvas is absent or static and the stamp has no transform animation.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): sound design, polish, reduced motion and mobile layout"`

---

# M11: Class Mode

### Task 21: Rooms backend + WebSocket

**Files:**
- Create: `backend/auditor/rooms.py`, `backend/tests/test_rooms.py`
- Modify: `backend/auditor/api.py` (add `POST /api/rooms`, `WS /ws/rooms/{code}`, register an `on_verdict` hook)

**Interfaces:**
- Produces:
  - `@dataclass PlayerState(player_id: str, name: str, case_id: str | None = None, score: int = 0, solved: bool = False, correct: bool = False, connected: bool = True)`
  - `@dataclass Room(code: str, status: Literal["lobby","running","ended"], level: int, seed: int, ends_at: float | None, players: dict[str, PlayerState])`
  - `RoomManager(store: SessionStore, clock)` with `.create() -> str` (4 letters from `ABCDEFGHJKLMNPQRSTUVWXYZ`), `.join(code, player_id, name) -> PlayerState` (reconnect-safe), `.start(code, level, seconds) -> dict[player_id, case_id]` (one `build_case(level, room.seed)` per player, sessions tagged with `room_code`, `started_at = now`), `.record_verdict(session, verdict)`, `.leaderboard(code, top=10) -> dict` and `.end(code)`
  - WebSocket messages exactly as in §10.2. `ticker` events are emitted on tool runs and accusations: `"{name} ran {tool name}"` / `"{name} accused {suspect}"`.

- [ ] **Step 1: Write failing tests:**
  - `test_room_code_format`: 4 chars, none of `I` or `O`
  - `test_join_broadcasts_lobby`: host WS and two player WS → the host receives `lobby` with 2 players
  - `test_start_gives_same_case_to_everyone`: two players receive `your_case`; both sessions' dfs are equal and their case_ids differ
  - `test_verdict_updates_leaderboard`: one player accuses correctly → the host receives `leaderboard` with that player first and `solved == 1`
  - `test_reconnect_keeps_state` (Review Focus 3): a player disconnects and rejoins with the same player_id → the same case_id, no duplicate in the lobby, and the score is kept
  - `test_double_accuse_counts_once` (Review Focus 2): `solved` stays 1
  - `test_join_after_start_gets_case`: a late joiner receives a `your_case` built with the same seed
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS). Broadcasting goes through a per-room set of WebSockets, and sends are wrapped so that a dead socket is dropped instead of crashing the broadcast.
- [ ] **Step 5: Commit** `git commit -am "feat(api): class mode rooms over WebSocket"`

### Task 22: Host projector + Play pages

**Files:**
- Create: `web/lib/ws.ts`, `web/app/host/page.tsx`, `web/app/host/[code]/page.tsx`, `web/app/play/[code]/page.tsx`, `web/components/host/{RoomCode,JoinQR,NameChips,Leaderboard,Ticker,CountdownRing,Podium}.tsx`, `web/e2e/class-mode.spec.ts`

**Interfaces:**
- `lib/ws.ts`: `useRoomSocket(code, role, {playerId?, name?}) -> {status, lastMessage, send}` with auto-reconnect (exponential backoff capped at 5 s). `playerId` is created once and stored in localStorage `auditor.player.v1`.
- The Play page reuses the Task 16–19 components with the mobile layout, fed by `your_case`.

Acceptance (§9.4 screens 9–10):
- `/host` creates a room → `/host/CODE`: a 160 px Playfair room code, a QR to `${origin}/play/CODE`, name chips springing in, a level picker and a round-length picker (3/6/10 min), and **Start**.
- During the round: a top-10 leaderboard animating reorders via Framer `layout`, the ticker scrolling, a countdown ring, a "solved 87 / 143" meter. The round ends on the timer or **End round**, then shows a podium (3rd, 2nd, 1st revealed with drumroll sound) and an **Open Class Autopsy** button.
- `/play/CODE`: a nickname form (max 16 chars, profanity is not handled; the host can kick by name, *Could*) → a lobby screen reading "Look up at the big screen" → the investigation when `your_case` arrives → the verdict, then "Waiting for the round to end".

- [ ] **Step 1: Write the failing e2e** `class-mode.spec.ts` with two browser contexts (host + player, and a second player): `host creates room → players join → host sees 2 chips → start → players see case → player A accuses (via debug truth) → host leaderboard row A first → end → podium visible`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): class mode host projector and player pages"`

---

# M12: Autopsy & Profiles

### Task 23: Autopsy analytics + Detective Profiles

**Files:**
- Create: `backend/auditor/autopsy.py`, `backend/auditor/profiles.py`, `backend/tests/test_autopsy.py`, `backend/tests/fixtures.py` (synthetic telemetry generator)
- Modify: `backend/auditor/api.py` (`GET /api/rooms/{code}/autopsy`, `GET /api/players/{player_id}/profile`)

**Interfaces:**
- `player_table(events: pd.DataFrame) -> pd.DataFrame` with index `player_id` and columns `n_tools, distinct_tools, budget_spent_ratio, seconds_to_accuse, correct, visual_tool_share, hacker_queries, score` (players who never accused: `correct=0`, `seconds_to_accuse = NaN`)
- `@dataclass Slide(title: str, figure: dict, code: str, stats: dict)`, where `code = inspect.getsource(<the slide's function>)`
- `build_autopsy(events: pd.DataFrame) -> list[Slide]`: the 6 slides from §8, in order
- `assign_archetypes(players: pd.DataFrame) -> pd.Series` with values in `{"The Statistician","The Gambler","The Hacker","The Visualizer"}`
- `Profile(player_id, name, archetype, tagline, stats: dict, radar_figure: dict)` (pydantic, in models.py)

- [ ] **Step 1: Write failing tests** (using `fixtures.synthetic_events(n_players=200, seed=0)`, which makes careful players use more tools and get it right more often):
  - `test_player_table_shape`: 200 rows with the exact columns
  - `test_autopsy_has_six_slides_with_code`: titles in §8 order, every `code` contains `"def "`
  - `test_tools_vs_accuracy_slide_stats`: slide 4 `stats` has `pearson_r > 0` and `p_value < 0.05` on the fixture
  - `test_archetypes_valid_and_deterministic`: two runs are identical, and all four labels appear on the 200-player fixture
  - `test_small_class_fallback`: 5 players → each still gets a valid archetype (the rule-based path)
  - `test_autopsy_empty_room`: no events → one slide titled "No detectives yet" (no crash)
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5:** Finish `notebooks/03_class_autopsy.ipynb` using the fixture and re-run the nbconvert check from Task 13.
- [ ] **Step 6: Commit** `git commit -am "feat: class autopsy analytics and detective profiles"`

### Task 24: Autopsy slide deck + Detective card

**Files:**
- Create: `web/app/host/[code]/autopsy/page.tsx`, `web/components/autopsy/SlideDeck.tsx`, `web/app/profile/[playerId]/page.tsx`, `web/components/profile/DetectiveCard.tsx`, `web/e2e/autopsy-profile.spec.ts`

Acceptance (§9.4 screens 11–12):
- The deck is full screen at 1920×1080, navigated with ←/→ and a progress pip row. Each slide shows the chart (60% width) with the Shiki code and key stats on the right. The title animates in with a typewriter effect, and there's a "CLASS AUTOPSY" cold-open slide.
- The Detective card is a trading-card frame (paper texture, foil gradient shimmer on hover), with the archetype title, tagline, radar chart, 4 stats and a **Save as PNG** button (html-to-image). After the verdict, players see "See your detective card".

- [ ] **Step 1: Write the failing e2e**: `seed a room via API with 3 debug players → open autopsy → 6+ slides navigable by ArrowRight → profile page shows an archetype and "Save as PNG" triggers a download`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): autopsy slide deck and detective cards"`

---

# M13: Extras (Could)

### Task 25: Hacker Mode (Pyodide in a Web Worker)

**Files:**
- Create: `web/lib/pyodide.worker.ts`, `web/components/hacker/HackerConsole.tsx`, `web/e2e/hacker.spec.ts`

**Interfaces:** the worker accepts `{type:"init", csvUrl}` → loads Pyodide (pinned CDN version, from `cdn.jsdelivr.net/pyodide/`), loads pandas and `df = pd.read_csv(...)`; it accepts `{type:"run", code}` and returns `{stdout, html?, error?}`. The console calls `hackerCharge` **before** each run.

Acceptance: a CodeMirror editor with Python highlighting and a green-on-black output pane. The first open shows a "Booting Python in your browser…" loader. Each run has a **5 s timeout** after which the worker is terminated and re-created ("Timed out"). Results have no pin button.

- [ ] **Step 1: Write the failing e2e** (Review Focus 4): `open console → run "print(df.shape)" → output shows "("; budget decreased by 1 → run "while True: pass" → "Timed out" within 7 s → the Tool Kit button is still clickable`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat(web): hacker mode with in-browser Python"`

### Task 26: Case Report PDF + Adaptive endless mode

**Files:**
- Create: `backend/auditor/report.py`, `backend/tests/test_report.py`
- Modify: `backend/auditor/api.py` (`GET /api/cases/{id}/report.pdf`; `POST /api/cases` with `level=7` and `player_id` uses `pick_scheme(profile from telemetry)`), web: a Reveal "Download case report" button, the Office's 7th folder labelled "Endless"

- [ ] **Step 1: Write failing tests:**
  - `test_report_is_pdf`: the bytes start with `b"%PDF"`, and there are 3 pages (count `/Type /Page` occurrences, excluding `/Pages`)
  - `test_report_409_before_verdict`
  - `test_level7_adapts`: telemetry with 10 zscore + 8 iqr_box runs for player P → `POST /api/cases {"level":7,"player_id":"P"}` truth scheme ≠ `"big_invoice"` across 10 creations
- [ ] **Step 2–4:** Run (FAIL), implement (`matplotlib.backends.backend_pdf.PdfPages`, seaborn `darkgrid` with noir colors), run (PASS).
- [ ] **Step 5: Commit** `git commit -am "feat: case report PDF and adaptive endless mode"`

---

# M14: Ship & Demo

### Task 27: Deploy, load test, demo checklist

**Files:**
- Create: `backend/Dockerfile`, `backend/fly.toml` (or a Railway config), `backend/scripts/load_test.py`, `README.md` (rewrite), `docs/DEMO.md`

- [ ] **Step 1:** `Dockerfile`: `python:3.12-slim`, install uv, `uv sync --frozen --no-dev`, `CMD uvicorn auditor.api:app --host 0.0.0.0 --port 8080 --workers 1`. Set the env `AUDITOR_DB=/data/auditor.db` on a mounted volume.
- [ ] **Step 2:** Deploy the backend to Fly.io (`fly launch`, `fly volumes create data`, `min_machines_running = 1` so it never sleeps) and the web to Vercel with `NEXT_PUBLIC_API_URL`. Set `WEB_ORIGIN` on the backend to the Vercel URL.
- [ ] **Step 3:** `scripts/load_test.py` (asyncio + `websockets`): create a room, connect 200 players, start, and measure `your_case` latency. Run `uv run python scripts/load_test.py --url wss://<backend> --players 200`. Expected: all 200 receive a case, p95 latency < 2 s, and server RSS stays < 512 MB per `fly status` / metrics (Review Focus 5).
- [ ] **Step 4:** `README.md`: a hero GIF, the pitch, a "How Python powers every move" section with a table of tool → library → function, the architecture diagram, local run commands and the live link + QR. `docs/DEMO.md`: a 5-minute script (title → solve Case 3 live with Benford → Class Mode with the professor's class → Autopsy slides → notebooks), plus a pre-demo checklist: open the backend 10 min early, test the venue Wi-Fi, set the projector to 1920×1080, sound check, and have a backup screen recording.
- [ ] **Step 5:** Run every gate: `cd backend && uv run ruff check . && uv run pytest -m "slow or not slow"`, and `cd web && pnpm lint && pnpm test && pnpm build && pnpm exec playwright test`. Expected: all green.
- [ ] **Step 6: Commit** `git commit -am "chore: deployment, load test, README and demo script"`

---

## Suggested Timeline (4 weeks, 4 people; compress or stretch to your deadline)

| Week | Data A | Backend B | Frontend C | Frontend D |
|---|---|---|---|---|
| 1 | T1–T4 | T5 | T14 | assets: portraits, textures, sfx |
| 2 | T6–T9 | T10–T12 | T15–T16 | T17 |
| 3 | T13, T23 | T21 | T22 | T18–T19 |
| 4 | notebook polish | T26, T27 | T24 | T20, T25 |
