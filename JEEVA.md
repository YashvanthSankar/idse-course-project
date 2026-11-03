# Jeeva: pipeline work still to do

The pipeline project is **TAREEKH: how long do Indian district-court cases take?**
Read first:
- [`IDEA.md`](IDEA.md): why this topic, and the rules (no leakage, honest evaluation, no gender as a model input).
- [`pipeline/README.md`](pipeline/README.md): how to run everything, what's built, every number measured so far, and the decisions with reasons.
- [`pipeline/reports/within_1y.md`](pipeline/reports/within_1y.md): the model results.

**Done (2026-11-03):** download tooling, all 80.9 M cases → parquet, Tamil Nadu (3.64 M cases)
cleaned and labelled, scrape cutoffs, three model families vs three baselines on a time split,
96 tests. Everything runs from `pipeline/` with the four commands in the README (~15 min,
mostly the download).

Tick items off in your commits. Keep the house rules: every cleaning or modelling rule gets a
test and a line in the README's decisions table; numbers in docs come from code, not memory.

---

## 1. Join the law and section each case was filed under (biggest expected model gain)
DDL's metadata says the per-case acts/sections live in a file called `acts_sections`
("linked to the case files using ddl_case_id"). It is **not** in `csv/cases/cases.tar.gz` or the
keys. It comes after the case archives in the Dropbox stream.
- [x] Found and downloaded: `data/raw/ddl/csv/acts_sections.tar.gz` (567 MB, CRC ok; fetch with
      `uv run python scripts/fetch_ddl.py --want 'csv/acts_sections*' --max-saves 1`, ~25 min).
- [ ] Turn it into `data/clean/10/acts_sections.parquet`: `build_dataset.py` already handles
      non-case CSVs inside a tar (keeps rows whose `ddl_case_id` starts with `"10-"`); run it with
      `--archive data/raw/ddl/csv/acts_sections.tar.gz`. Check the column names first
      (`tar tzvf …`, then `head` of the CSV) and whether a case can have several acts.
- [ ] Map its act column through `act_key.csv` → `tareekh.acts.canonical_act` (94.1% coverage
      already measured) and its section through `section_key.csv` (70 MB, also messy: e.g.
      `"!#11bofHindumarriageAt1955"`; write `tareekh/sections.py` the same way as `acts.py`).
- [ ] Add `law` (canonical act) and, for the big laws, a few section groups (IPC 302 vs 379 vs
      498A; NI Act 138) as features; retrain; record the change in the README.
- **Done when:** coverage of the join is reported (share of TN cases with a law), and the model
  is retrained with and without it, both rows in `reports/within_1y.md`.

## 2. EDA notebooks (the "explore" stage graders look for)
Put them in `pipeline/notebooks/`, reading `data/clean/…` parquet. Show the raw mess *before*
the clean result.
- [ ] `01_audit.ipynb`: missing values per column; impossible dates (year 0001 / 7201,
      `5000-01-01`, 23,497 decided-before-filing in TN); 29,857 law spellings → 56 laws; 157 court
      names → 14 levels; gender "unclear" shares; the two disagreeing outcome fields.
- [ ] `02_eda.ipynb`:
  - monthly decisions per state with the scrape cliff marked (the most striking chart);
  - cases per filing year in the *same* 592 courts (171k → 622k): the survivorship finding;
  - pending share of 2010 filings by state (Bihar 61% … Haryana 0.9%), as a map or bar chart;
  - Tamil Nadu: within-a-year rate by case type and by district; time to decision is
    heavy-tailed, so use a log axis;
  - why "median days among decided cases" is wrong: it falls from 1,343 (2010) to 18 days (2017)
    purely because recent slow cases haven't finished yet.
- **Done when:** each chart has a one-line takeaway under it, and the notebooks run top to bottom
  on a fresh `data/clean`.

## 3. k-means: groups of districts (syllabus algorithm)
- [ ] Profile each Tamil Nadu district: within-a-year rate for the 6 biggest case types, pending
      share, clearance rate, cases per court. Standardise, choose k with elbow + silhouette,
      name the clusters ("fast civil, slow criminal", …), map them.
- [ ] Optional: the same for all states using `data/clean/national/`.
- **Done when:** `03_clusters.ipynb` shows the k choice and the cluster table; the analytics
  export (task 6) includes the cluster per district.

## 4. Still-open curves (better than one horizon)
- [ ] Kaplan–Meier "share of cases still open after N months" by case type, using
      `observed_days` and `ended` (censoring handled properly). Either add `lifelines` to
      `pyproject.toml` or write the estimator in numpy (~20 lines, and a nice viva point).
- [ ] Use it to show the 6-month / 1-year / 2-year picture on the site.

## 5. Model follow-ups
- [ ] **Drift:** courts got faster (36% → 44% → 50% within a year for 2015 → 2017 filings), so
      the model under-predicts 2017 by 2–4 points. Try recalibrating on the most recent year
      (e.g. Platt scaling on 2016) and report the before/after calibration table.
- [ ] **Sensitivity:** rerun with `label_cases.py --share 0.25`, and with horizons of 180 and
      730 days; add a short table to the README.
- [ ] Per-district and per-case-type AUC on 2017, so we can say where the model is weak.
- [ ] Keep the protocol: choose on 2016, report 2017 once. Don't pick the model by its 2017 score.

## 6. Website `/model` (separate from the game; same domain)
Model file is 3 kB (`artifacts/within_1y/model.joblib`, scikit-learn 1.9.1, same as the backend).
- [ ] **Export script** `scripts/export_site.py` → `artifacts/site/`:
  - the input options from `metadata.json` (districts, court levels, case types);
  - the latest congestion values per district × court level (the model needs
    `log_pending_at_filing`, `clearance_last_year`, `log_prev_year_filings`; a visitor can't
    supply these, so use the values at the end of the data and say so);
  - aggregates for the charts (task 2), clusters (task 3), still-open curves (task 4), model
    metrics, plus ~200 held-out 2017 cases (no ids) for "test the model on a real case".
- [ ] **API** (FastAPI): `GET /api/model/options`, `POST /api/model/predict`,
      `GET /api/model/analytics`. Decide hosting first: routes in the game backend (simplest; the
      game uses ~235 MB of its 800 MB limit, and this adds a few MB) or a tiny separate service.
- [ ] **Pages** (Next.js, its own plain style, not noir): *Predict* (examples like
      "cheque bounce · Chennai", compare two courts side by side, "test on a real past case"),
      *Analytics*, *About the model* (data, cleaning, results vs baselines, limitations).
- [ ] On screen, always: "Based on Tamil Nadu district-court records filed 2015–2017. A
      historical estimate, not a prediction for your case, not legal advice." Credit: "Contains
      data from Development Data Lab's judicial data, ODbL v1.0."
- [ ] Deploy backend first, then the site (same order as the game).

## 7. Write-up and viva
- [ ] Report following the six stages (problem → collection → preparation → EDA → modelling →
      deployment), built from the README's measured facts and decisions table.
- [ ] Glossary of Tamil Nadu case types (OS = original suit, CC = calendar case, MCOP = motor
      accident claim, EP = execution petition, STC = summary trial, HMOP = Hindu marriage
      petition, CRLMP = criminal miscellaneous petition, …): **verify each abbreviation** before
      using it.
- [ ] Confirm the rubric and deadline with the professor (required algorithms, whether
      deployment and analytics are marked).
