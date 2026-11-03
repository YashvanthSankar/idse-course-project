# Pipeline: TAREEKH — how long do Indian court cases take?

*"Tareekh pe tareekh"* (date after date). The IDSE (CS3006) end-to-end project: real Indian
district-court records → cleaning → EDA → a model of how long cases take → `/model` on the site.

- **Why this topic, and the rules the work must follow:** [`../IDEA.md`](../IDEA.md).
- **This file:** how to run things, what is built, and what we have *measured* so far.
- **Work still to do:** [`../JEEVA.md`](../JEEVA.md).

## Run it

```bash
cd pipeline
uv sync                      # Python 3.12; scikit-learn pinned to the game backend's 1.9.1
uv run pytest                # cleaning, cutoff and download tests
uv run python scripts/fetch_ddl.py --want 'license.txt' --want 'csv/keys/*' --want 'csv/cases/*' --max-saves 3
```

Raw data goes to `data/raw/ddl/` and never into git. The case archive is large
(`cases.tar.gz` holds one CSV per filing year; `cases_2010.csv` alone is 857 MB, 2017 and 2018
are about 2.6–2.7 GB each).

## Layout

```
pipeline/
├── scripts/fetch_ddl.py   download chosen files from DDL's Dropbox (see "Getting the data")
├── src/tareekh/
│   ├── acts.py            ~30,000 raw law names → 56 canonical laws
│   ├── cases.py           load a yearly case file: decode codes, gender sentinels, bad dates
│   └── cutoff.py          estimate when each state/district was scraped
├── tests/                 54 tests; law-name tests use real spellings from the data
├── data/raw/              downloads (git-ignored)
├── data/clean/            cleaned parquet (git-ignored)
├── notebooks/             EDA and modelling notebooks (to do)
├── artifacts/             exported model + metadata for the site (to do)
└── reports/               figures and write-up (to do)
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
csv/cases/cases.tar.gz            → cases_2010.csv, cases_2018.csv, cases_2017.csv, … (one per filing year)
dta/…                             (Stata copies, skipped)
```

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

## Decisions so far

| Decision | Why |
|---|---|
| Main state: **Tamil Nadu** (code 10) | IIITDM is in Chennai; ~171k cases a year; a middle pending share (9.7%) rather than an extreme |
| National aggregates for the analytics page only | Pending share by state is a striking chart and is cheap; the model stays one state |
| Dates outside 1950–2022 are blanked, not "fixed" | We can't know the intended date; we count them instead |
| Unmatched law names stay "Other" | A wrong canonical law is worse than an honest "Other" |
| Target and model choice wait for the cutoff on all years | The cutoff decides which cases can be labelled at all |
