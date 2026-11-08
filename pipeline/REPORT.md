# How long do Indian district-court cases take?

**IDSE (CS3006) end-to-end data science project** · data: Development Data Lab's judicial data
(eCourts, 2010–2018, ODbL v1.0) · live at `otlr.vercel.app/model` · code: `pipeline/`

Every number below was produced by the code in this folder; the generated reports
(`reports/analysis.md`, `reports/within_1y.md`, `reports/experiments.md`) and the five
notebooks (start with `notebooks/00_full_pipeline.ipynb`) hold the full tables and charts (`reports/figures/`).

---

## 1. Problem

India's district courts are known for delay. We ask a
question a litigant, journalist or student could use:

> **Given what is known on the day a case is filed in a Tamil Nadu district court, how likely
> is it to be disposed of within a year?**

"Disposed of" means the case ended *in that court*: a judgment, dismissal, settlement or Lok Adalat
disposal, or a file closed while the accused absconds. A transfer to another court is not an end.
We also describe how long cases stay open (survival curves) and how districts differ.

Why this question: it uses real, messy, public data that no other group in the class is using,
and it forces the hard parts of data science (censoring, leakage, drift) into the open.

## 2. Collection

- **Source:** Development Data Lab (DDL) processed and de-identified ~81 million case records from
  the government's eCourts portal. **80,935,944 cases** filed 2010–2018 in this release.
- **Getting it:** Dropbox refuses single-file links into DDL's shared folder, and "download folder"
  streams everything (CSV *and* Stata copies) as one zip. `scripts/fetch_ddl.py` parses that stream,
  keeps only the requested entries, checks each CRC-32, and stops early (tested against zips built
  the same way, including a fake signature inside the data).
- **What we took:** the lookup keys (66.5 MB), the yearly case files (1.41 GB compressed,
  16.16 GB CSV) and the per-case acts/sections file (567 MB compressed, 3.57 GB CSV).
- **Licence:** the licence file in the download is **ODbL v1.0**, although the website says
  CC BY-NC-SA. ODbL allows our use with attribution; derived databases we share must stay ODbL.
- **Scope:** Tamil Nadu (where IIITDM is) for modelling, **3,640,055 cases**; all of India for the
  scrape-date and backlog charts. `scripts/build_dataset.py` streams the archive into parquet in one
  pass (~1.5 min), reading every column as text so zero-padded codes ("01") survive.

## 3. Preparation (cleaning)

| Problem found | Measured | What we did |
|---|---|---|
| Law names typed by hand | 29,857 distinct raw names ("NegotiableInstrumentsAct", "N. I. Act", "U/S 138 of N.I Act") | ordered regex rules on a letters-only form → **54 laws**, 94.1% of rows named, 2.0% junk (".", "---", "ACT"), 4.0% honestly left "Other" (`acts.py`) |
| Section strings | NI Act 2,454 → 227, MV Act 24,310 → 616, civil procedure 61,776 → 1,134 distinct after parsing | main section + suffix: 304(B) → 304B, "138r/w142" → 138, "OVIIR1" → Order 7 (`sections.py`) |
| Court names | 116 strings with typos and place names ("trail", "musif", "subardinate") | → 14 court levels + "unclear" (`courts.py`) |
| Impossible dates | year 0001 / 7201, `5000-01-01` placeholders (95,219 in last-hearing dates); 23,497 TN cases "decided before filing" | blanked outside 1950–2022 and counted; bad cases excluded with a reason |
| Sentinel codes | gender "-9998 unclear" / "-9999 missing": defendant unclear 22%, petitioner 45% | decoded to categories; gender kept out of the model |
| 52 disposition categories | mix endings, transfers, bail orders, missing | each given a deliberate group; **transfers, committals, remands, Lok Adalat referrals = "moved"** (censored, not ended) (`outcomes.py`) |
| Two outcome fields disagree | cases with a decision date but "disposition missing", and the reverse | the decision date decides whether a case ended |

Every rule has tests using real strings from the data (132 pipeline tests).

### The two findings that decide everything else

**1. There is no scrape date, so we estimated it.** Monthly decisions in India run at about
1.0 million (median month of 2018), then 790k in January 2019, 286k in February, 172k in March:
the data was collected in **January–February 2019** (`eda_scrape_cliff.png`). A case with no
decision is only known to be pending up to that date. `cutoff.py` finds, per district, the last
month before the first lasting collapse, using at least half a normal month as "observed" because
February was only partly captured. A first version ("last normal-looking month") put Tamil Nadu in
July 2020; it was replaced and the traps became tests.

**2. The early years are incomplete.** The same 592 Tamil Nadu courts present since 2010 record
170,958 cases filed in 2010 and 622,473 in 2018 (×3.6), and same-day disposals grow from 0.7% to
18% of cases (`eda_survivorship.png`). Courts did not get 3.6× busier: cases that ended quickly
before a court went digital were mostly never entered. Early cohorts therefore look far slower than
they were. **We model 2015–2017 filings only.**

### Labels that don't guess (`target.py`)

- Each case gets `observed_days` (to its end, its transfer, or the cutoff) and `ended`.
- "Disposed of within 365 days?" is defined only for cases filed at least a year before their
  court's cutoff, so every labelled case had the full year. A first version labelled recent cases
  that ended fast while their slow neighbours were unknown: 2018 filings came out about 93% "within a
  year". The fix is the eligibility rule; transfers before a year stay unlabelled.
- Eligible: 405,062 (2015), 445,639 (2016), 549,273 (2017) cases; 36%, 44% and 49% disposed of
  within a year.

## 4. Exploratory analysis

(`notebooks/01_audit.ipynb`, `02_eda.ipynb`, `03_survival_and_clusters.ipynb`)

- **Outcomes (TN):** decided 33%, no disposition / pending 26%, dismissed 19%, **moved 14%**,
  disposed (manner unknown) 5%, settled 3%.
- **"Median days among decided cases" is a trap:** it falls from 1,366 days (2010 filings) to
  17 days (2017) only because recent slow cases haven't finished (`eda_median_trap.png`).
- **Still open after N months (Kaplan–Meier, TN filings 2015–2018):** median 532 days; 57% open
  after a year, 43% after two, 25% after four. Summary trials (petty offences) end within days;
  calendar (criminal) cases have a median of 1,326 days, accident claims 1,243
  (`survival_still_open.png`).
- **By kind of case:** within a year 98% for criminal miscellaneous petitions (bail-type), 80%
  summary trials, 52% original petitions, 47% Hindu marriage petitions, 28% original suits,
  22% calendar cases, 12% accident claims.
- **By court:** district/sessions judges 54%, magistrates 52%, family courts 43%, munsif courts
  32%, sub courts 22%, small cause courts 16%, accident claims tribunals 8%.
- **By district:** from 19% (Perambalur) to 74% (Theni).
- **By state (2010 filings still open at the scrape):** Bihar 63%, Odisha 41%, Uttar Pradesh 38%,
  West Bengal 34% … Tamil Nadu 10% … Punjab and Haryana 1% (`eda_pending_by_state.png`). Part real
  backlog, part records never updated.
- **k-means on districts** (rates for six big case types + backlog, standardised; k by silhouette
  for k = 2…8): k = 3, but the best silhouette is **0.19**. Districts form a continuum, so the
  groups are reported as a summary, not a discovery.

## 5. Modelling

**Inputs (known on the filing day only):** district, court level, case type, month, law, main
section (40 most common law + section pairs), IPC bailable or not, number of IPC sections,
criminal/civil, and court congestion: cases already pending in that district's courts of that level
and how many they cleared in the year before, plus last year's filings of that type. **Excluded:**
hearing dates and purposes (they describe the future), gender (fairness), court number (unknown to
a visitor).

**Protocol:** choose on 2016 (train 2015), refit on 2015–2016, **test once on 2017** (a later year,
549,273 cases). Baselines: overall rate, rate per case type, rate per case type × district (a
lookup table). Models: logistic regression, linear SVM (calibrated), random forest, each with a
small grid, with and without the law inputs. The served model is whichever had the best 2016 log
loss: **logistic regression with the law inputs** (6 kB).

| 2017 test (unseen) | AUC | Brier | log loss |
|---|---|---|---|
| rate per case type (baseline) | 0.828 | 0.163 | 0.502 |
| rate per case type × district (baseline) | 0.844 | 0.163 | 0.492 |
| logistic regression, filing basics only | 0.842 | 0.158 | 0.483 |
| **logistic regression + law and section (served)** | **0.873** | **0.138** | **0.427** |
| linear SVM + law and section | 0.873 | 0.137 | 0.429 |
| random forest + law and section | 0.874 | 0.138 | 0.428 |

- **Confusion matrix (2017, threshold 50%):** 192,541 correctly predicted over within a year,
  251,578 correctly predicted not; 25,937 predicted over but weren't, 79,217 predicted not but
  were. Precision 88.1%, recall 70.9%, accuracy 80.9%. The model errs towards "not within a year".
- **Calibration:** a predicted 55% happens 56% of the time, 85% → 87%, 97% → 98%
  (`model_calibration.png`).
- **What it relies on** (permutation importance): case type 0.31, law + section 0.10, law 0.06;
  everything else ≤ 0.02.
- **Other horizons** (served model vs rate per case type): 6 months AUC 0.917 vs 0.872; 1 year
  0.873 vs 0.828; 2 years 0.826 vs 0.771.
- **Robustness:** the stricter and looser cutoff rules give identical 2017 results.
- **Drift:** courts got faster each year, so 2017 is under-predicted (47.3% predicted vs 49.5%
  observed); weighting 2016 more barely helps (47.7%).
- **Weakness:** *within* one case type the model ranks poorly (AUC 0.49–0.62 for rent, domestic
  violence, maintenance, execution, marriage and original suits). It mostly knows which *kinds* of
  case are quick.
- **Linear regression on days** (exploratory, because it needs finished cases: among cases
  disposed of within 730 days; train on 2015 filings, test on 2016): R² on log days 0.669 vs
  0.611 for the median per case type, median error 42.5 vs 51 days, but mean error 116 vs 109 days,
  so it is better on typical cases and slightly worse on the long tail.
- **Lessons from things that didn't work:** a random forest allowed every input at every split
  learned 2015's exact congestion levels and did worse on 2016 (AUC 0.79); without the law inputs
  the models barely beat a lookup table.

## 6. Deployment

- `scripts/export_site.py` packages the model, the 40 most common real kinds of case (59% of 2017
  filings, with plain-English names), each court's congestion at the end of the data, 300 real 2017
  test cases and the analytics.
- The game's FastAPI backend serves `/api/model/options | predict | sample | analytics`
  (`game/backend/auditor/tareekh/`); 9 API tests, including one that checks the site scores a test
  case exactly as the pipeline does and one that checks the explanations add up to the model's log-odds.
- The Next.js site serves `/model` (what was built), `/model/explore` (choose options, press
  **Analyze**, read the prediction, each input's effect, the exact inputs sent, and the model's
  identity and test results), `/model/pipeline` (every step of both pipelines) and
  `/model/analytics` (what the data shows). Model calls go through the site's own domain, so a
  visitor only needs to reach Vercel.

## Limitations

- Tamil Nadu, cases filed 2015–2017, scraped early 2019; courts have changed since.
- Congestion inputs on the site are the values at the end of the data, not today's.
- Within one kind of case, the model can barely tell faster from slower cases.
- Kaplan–Meier assumes watching stops for reasons unrelated to how soon a case would end; true for
  the scrape cutoff, an approximation for transfers.
- A statistical summary of past cases, not a prediction for any real case, and not legal advice.

## Reproduce

```bash
cd pipeline && uv sync && uv run pytest
uv run python scripts/fetch_ddl.py --want 'license.txt' --want 'csv/keys/*' --want 'csv/cases/*' --max-saves 3
uv run python scripts/fetch_ddl.py --want 'csv/acts_sections*' --max-saves 1
mkdir -p data/raw/ddl/keys && tar xzf data/raw/ddl/csv/keys/keys.tar.gz -C data/raw/ddl/keys
uv run python scripts/build_dataset.py --state 10
uv run python scripts/build_dataset.py --state 10 --archive data/raw/ddl/csv/acts_sections.tar.gz
uv run python scripts/label_cases.py --state 10
uv run python scripts/train_within_1y.py
uv run python scripts/analyse.py && uv run python scripts/experiments.py
uv run python scripts/export_site.py
```
