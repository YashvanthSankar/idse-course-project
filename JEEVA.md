# Jeeva: pipeline project status and what's left

The pipeline project: **how long do Indian district-court cases take?**
- Findings and results: [`pipeline/REPORT.md`](pipeline/REPORT.md) (the write-up, stage by stage).
- How to run everything, the raw facts and every decision: [`pipeline/README.md`](pipeline/README.md).
- Why this topic and the rules: [`IDEA.md`](IDEA.md).

House rules: every cleaning or modelling rule gets a test and a line in the README's decisions
table; numbers in docs come from the generated reports, never from memory.

## Done (2026-11-03)

- [x] Download tooling (Dropbox stream, CRC-checked) for the keys, the 16 GB case archive and the
      3.57 GB acts/sections file.
- [x] All 80.9 M cases → parquet; Tamil Nadu (3.64 M) cleaned: laws, sections, courts, dates,
      sentinels, outcomes.
- [x] Scrape cutoffs per district; labels that respect censoring; early-year survivorship found
      and handled.
- [x] Model: 3 baselines × logistic regression / linear SVM / random forest × 2 input sets on a
      time split. Served: logistic regression + law and section, 2017 AUC 0.873, Brier 0.138.
- [x] Kaplan–Meier still-open curves, k-means districts (weak structure, reported as such),
      experiments (drift, 6-month / 2-year horizons, cutoff rule, weak spots).
- [x] Four executed EDA/model notebooks + figures in `pipeline/reports/figures/`.
- [x] `/model` site, in plain language: **Check a case** (pick one of 13 everyday topics and a
      district → "usually takes about …", "N in 10 are over within a year", still-open milestones,
      plain reasons, compare districts, "can the model guess right?" on real 2017 cases),
      **What the data shows** (five stories), **How it works** (plain summary + folded technical
      section). Served by the game backend at `/api/model/*`. Tests: 138 pipeline, 9 API (in 400
      backend), 3 e2e for /model.
- [x] Linear regression on days to disposal (`scripts/regress_days.py`), added 2026-11-08: it
      was listed here as done before it existed.
- [x] Write-up: `pipeline/REPORT.md`.

## Left

1. [x] **Deployed** 2026-11-03 (backend, then `vercel deploy --prod` from `game/web`); live checks
       pass. **Watch the network:** from Jio, ~30% of connections to the VPS were lost on the
       route (not the server). Test from another network before class; if it persists, put
       Cloudflare in front of the VPS (needs a domain).
2. [ ] **Confirm the rubric and deadline with the professor**: required algorithms (we have
       linear and logistic regression, SVM, random forest, k-means), and whether deployment and
       analytics are marked.
3. [ ] **Check the glossary** in `pipeline/src/courtcases/glossary.py` (case-type abbreviations and
       section meanings) before the viva; it lists only meanings we're confident of, but each
       should be verified against a source.
4. [ ] **Viva prep**: walk through REPORT.md sections 3–5; the strongest points are the scrape
       cutoff, the early-year survivorship, the label-eligibility rule, and the honest
       "within one case type it ranks poorly" limitation.

## Optional, if there's time

- [ ] Recalibrate for drift (e.g. Platt scaling on the latest year) and show the before/after
      calibration table; experiments show recency weighting alone barely helps.
- [ ] A second state for contrast (Bihar: 63% of 2010 filings still open), using the same scripts
      with `--state 08`.
- [ ] An "other kind of case" mode on the site (pick case type, law and section separately) for
      the 41% of cases outside the 40 common kinds.
- [ ] Dark mode for `/model` (the palette has validated dark steps in the dataviz reference).
