# Pipeline: TAREEKH — how long do Indian court cases take?

*"Tareekh pe tareekh"* (date after date). The IDSE (CS3006) end-to-end project: real Indian
district-court records → cleaning → EDA → a model of how long cases take → `/model` on the site.

- **Why this topic, and the rules the work must follow:** [`../IDEA.md`](../IDEA.md).
- **This file:** how to run things, what is built, and what we have *measured* so far.
- **Work still to do:** [`../JEEVA.md`](../JEEVA.md).

## Run it

```bash
cd pipeline
uv sync                                   # Python 3.12; scikit-learn pinned to the game backend's 1.9.1
uv run pytest                             # 96 tests
# 1. download (≈1.6 GB streamed, ~10 min): licence, keys, and the case archive
uv run python scripts/fetch_ddl.py --want 'license.txt' --want 'csv/keys/*' --want 'csv/cases/*' --max-saves 3
mkdir -p data/raw/ddl/keys && tar xzf data/raw/ddl/csv/keys/keys.tar.gz -C data/raw/ddl/keys
# 2. parquet for all of India (narrow) and Tamil Nadu (every column): ~1.5 min
uv run python scripts/build_dataset.py --state 10
# 3. scrape cutoffs + labels → data/clean/10/{cutoffs,labelled}.parquet: ~1 min
uv run python scripts/label_cases.py --state 10
# 4. train + evaluate → artifacts/within_1y/, reports/within_1y.md: ~1.5 min
uv run python scripts/train_within_1y.py
```

Raw data goes to `data/raw/ddl/`, cleaned data to `data/clean/`; neither goes into git. The case
archive is 1.41 GB compressed, 16.16 GB as CSV (one file per filing year, 0.86 to 2.72 GB).

## Layout

```
pipeline/
├── scripts/
│   ├── fetch_ddl.py         download chosen files from DDL's Dropbox (see "Getting the data")
│   ├── build_dataset.py     stream the 16 GB archive into parquet in one pass
│   └── train_within_1y.py   baselines + 3 model families, time split, writes the report
├── src/tareekh/
│   ├── acts.py              ~30,000 raw law names → 56 canonical laws
│   ├── courts.py            157 court names → 14 court levels
│   ├── cases.py             decode codes, gender sentinels and impossible dates
│   ├── outcomes.py          the 52 dispositions → ended / moved / interim / missing …
│   ├── cutoff.py            when each state/district was scraped
│   ├── target.py            observed time, ended, and "within H days" labels
│   └── features.py          filing-day inputs, incl. court congestion
├── tests/                   96 tests; law and court tests use real strings from the data
├── artifacts/within_1y/     model.joblib (3 kB) + metadata.json: what the site will load
└── reports/within_1y.md     generated results (do not edit by hand)
```

## Getting the data

Source: Development Data Lab, <https://www.devdatalab.org/judicial-data>.

Dropbox refuses single-file links into DDL's shared folder ("No Access"); the only way in is
"download folder", which streams the entire folder (CSV *and* Stata copies, tens of GB) as one
zip. `scripts/fetch_ddl.py` reads that stream, keeps only the entries asked for, verifies each
against its CRC-32 and stops early. The archive layout, read from the stream:

```
license.txt
csv/keys/keys.tar.gz     66.5 MB  → act_key, section_key, type/purpose/disp keys, court/district/state keys, judge_case_merge_key
dta/keys/keys.tar.gz    120.7 MB  (Stata copy, skipped)
csv/cases/cases.tar.gz 1,408.8 MB → cases_2010.csv, cases_2018.csv, cases_2017.csv, … (one per filing year)
dta/cases/cases.tar.gz 2,433.2 MB  (Stata copy, skipped)
csv/judges_clean.tar.gz    0.9 MB  judges and their appointment dates
dta/judges_clean.tar.gz    2.7 MB  (Stata copy)
csv/acts_sections.tar.gz 567.4 MB  the law and section of every case, keyed by ddl_case_id
```

The acts file starts ~4 GB into the stream, so fetching it alone still streams ~4.6 GB
(~25 min): `uv run python scripts/fetch_ddl.py --want 'csv/acts_sections*' --max-saves 1`.

**Licence: the file in the download is ODbL v1.0 (Open Database License),** not the
CC BY-NC-SA the website states. Under ODbL we may use the data and publish charts and a model
built from it with attribution; a database we derive from it and share must also be ODbL.
Credit on the site: *"Contains data from Development Data Lab's judicial data, ODbL v1.0."*

## Measured so far (2026-11-03)

### The law names (`act_key.csv`)
- **29,857 distinct raw law names** across 76.8 million case–law rows.
- About **1,200 strings mention the Penal Code / IPC**, **753 spell the Motor Vehicles Act**,
  **215 spell the Negotiable Instruments Act** ("NegotiableInstrumentsAct", "N. I. Act",
  "U/S 138 of N.I Act", "Negotiable Instruments Act  \").
- The 60 most common strings cover 79% of rows. Junk values: ".", "---", "ACT", "Sec.", "U/s".
- Counts for the biggest entries are stored rounded in scientific notation (`2.09e+07`), so the
  largest totals are approximate.
- Clear data-entry errors: tens of thousands of district cases tagged as the *AICTE Act*, the
  *Andhra Pradesh Legislative Council Act*, the *AIIMS Act* (a wrong pick from a dropdown).
- **`acts.py` maps 94.1% of rows to one of 56 canonical laws**, 2.0% to *Unknown* (junk) and
  leaves 4.0% as *Other* rather than guess. Rules run on a "squashed" name (letters only) and go
  from specific to general ("Dowry Prohibition Act … IPC" is a dowry case).
- Also messy: **11,500 distinct raw case types**, **15,690 hearing-purpose strings**. DDL already
  grouped dispositions into **52 categories**.

### The cases (`cases_2010.csv`: everything filed in 2010)
- **4,281,327 cases** from 31 states/UTs; columns: ids, state/district/court codes, judge
  position, four gender columns, coded type / purpose / disposition, five dates. Acts and
  sections are in a separate file, not in the case file.
- **13.3% have no decision date** at the time of scraping.
- Median time to decision among decided cases: **914 days (~2.5 years)**; 25% within 328 days,
  10% take more than 6.6 years (2,422 days).
- **Impossible dates:** decisions dated year 0001 and 7201; `5000-01-01` placeholders in hearing
  dates; **25,758 decisions dated before filing**; 140,069 decided on the day of filing.
  `cases.py` blanks and flags dates outside 1950–2022 and decisions before filing.
- Gender: defendant "unclear" for 18%, petitioner "unclear" for 46%; advocate gender missing for
  most rows. Treat gender as EDA only, never as a model feature without caveats.
- **The two outcome fields disagree:** 45,938 cases have a decision date but the disposition
  "disposition var missing"; some "transferred"/"disposed" cases have no date.

### When was it scraped? (the censoring cutoff)
There is no "scraped on" column. Monthly decisions (2010 filings, all India) run at ~11,000 a
month until **January 2019**, then fall to ~1,500 a month: the scrape. Most courts stop in
Jan–Feb 2019; some were re-scraped later. Pending share for 2010 filings varies wildly by state:
**Bihar 61%, Odisha 40%, Uttar Pradesh 37%, West Bengal 31%, Tamil Nadu 9.7%, Haryana 0.9%,
Punjab 1.1%**. Part of that is real backlog, part is probably cases never updated.

`cutoff.py` estimates each group's cutoff as the day before the **first lasting collapse** of
monthly decisions. An earlier version ("last normal-looking month") was wrong: it was dragged
years late by the post-scrape trickle and fooled by one cohort running out of cases. That
version's output on real data (Tamil Nadu: July 2020 vs its districts' Jan–Feb 2019) is why it
was replaced; the tests now cover both traps plus vacation dips.
**Run it on all filing years together**, not on a single cohort.

### All years, all India (2026-11-03)
- **80,935,944 cases** filed 2010-2018: 4.28 M (2010) rising to 13.72 M (2018).
  **Tamil Nadu: 3,640,055.**
- **Scrape dates, from all filing years together:** almost every state was scraped in
  **January-February 2019**; a few later (Kerala, Gujarat March 2019; West Bengal, Chandigarh
  early 2020). Tamil Nadu's monthly decisions: ~45-85k a month in 2018, 32k in Jan 2019, 13k in
  Feb, 4.5k in March, so the scrape ran *during* February. We use "the last month with at least
  half a normal month" (TN districts: Dec 2018 to Feb 2019) so partly scraped months don't make
  decided cases look pending.

### Early years are incomplete (survivorship)
The same 592 Tamil Nadu courts present from 2010 record 171k cases filed in 2010 and 622k in
2018 (×3.6), and same-day decisions rise from 0.7% of cases to 18%. Courts didn't get 3.6×
busier: cases that finished quickly *before* a court went digital were mostly never entered.
Early cohorts therefore look much slower than they were (6% of 2010 filings "within a year" vs
50% of 2017's). **Models use 2015-2017 filings only.**

### Labelling (Tamil Nadu)
Cutoff per district (with state fallback) → `tareekh.target.label` → `within(…, 365)`.
Of 3,640,055 cases: 23,497 decided before filing, 1,554 bail orders and 41 impossible decision
dates are unusable (an earlier run without the state fallback also marked 89,880 as "filed after
the cutoff" because one district's dip gave it a 2012 cutoff); outcome groups: decided 33%, pending /
no disposition 26%, dismissed 19%, **moved 14%**, disposed (manner unknown) 5%, settled 3%.
A first version of the one-year label was biased: 2018 filings came out 92.6% "within a year"
because only fast cases could be known. Fixed by requiring full follow-up (filed ≥1 year before
the cutoff). Eligible: 405k (2015), 446k (2016), 549k (2017) cases; 36%, 44%, 50% within a year.

### The model (full tables: [`reports/within_1y.md`](reports/within_1y.md))
Test = 549,273 cases filed in 2017, never seen during training or model choice.

| | AUC | Brier | log loss |
|---|---|---|---|
| rate per case type (baseline) | 0.828 | 0.163 | 0.502 |
| rate per case type × district (lookup baseline) | 0.844 | 0.163 | 0.492 |
| **logistic regression (served; chosen on 2016)** | 0.842 | **0.158** | **0.483** |
| linear SVM, calibrated | 0.843 | 0.157 | 0.481 |
| random forest | **0.847** | 0.159 | 0.488 |

What it means, honestly:
- **Case type carries most of the signal** (permutation importance 0.35 vs ≤0.02 for anything
  else). The models give better *probabilities* than a lookup table, but rank cases about as
  well. The site must say so.
- **Courts got faster year on year** (36% → 44% → 50%), so a model trained on 2015-16
  under-predicts 2017 by 2-4 points in most bands. The random forest given every input per split
  learned 2015's exact congestion levels and did worse on 2016 (AUC 0.79): drift, not noise.
- Congestion features (pending cases and last year's clearance in the district's courts of
  that level on the filing day) helped a little (2016 log loss 0.500 → 0.495).
- Missing and likely to help: **the law and section** the case was filed under (the per-case
  `acts_sections` file; see JEEVA.md).

## Decisions so far

| Decision | Why |
|---|---|
| Main state: **Tamil Nadu** (code 10) | IIITDM is in Chennai; ~171k cases a year; a middle pending share (9.7%) rather than an extreme |
| National aggregates for the analytics page only | Pending share by state is a striking chart and is cheap; the model stays one state |
| Dates outside 1950–2022 are blanked, not "fixed" | We can't know the intended date; we count them instead |
| Unmatched law names stay "Other" | A wrong canonical law is worse than an honest "Other" |
| Cutoff = last month with ≥ half a normal month of decisions | February 2019 was only partly scraped |
| Moved cases (transfer, committal, remand, Lok Adalat referral) are censored, not "ended" | They left this court; they didn't finish |
| One-year label only for cases filed ≥1 year before the cutoff | Otherwise recent filings are biased towards "fast" |
| Train 2015-16, test 2017 | Early years are incomplete; a later test year is the honest test of a forecast |
| Served model = best 2016 log loss (logistic regression) | Chosen before looking at 2017; the forest's better 2017 AUC doesn't change that |
| No gender, no hearing purpose, no later dates as inputs | Fairness rule in IDEA.md; the rest leak the future |
