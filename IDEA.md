# IDSE project context: OUTLIER + court-case analytics

## Status update (2026-11-03)

- **Topic confirmed:** court-case duration. Crop prices, a scam-message detector and JoSAA
  cutoffs were considered and dropped (generic, or outside our domain knowledge).
- **Data inspected:** the DDL keys and all 4,281,327 cases filed in 2010 have been downloaded and
  audited. Measured facts, the download method and decisions are in
  [`pipeline/README.md`](pipeline/README.md); remaining work is in [`JEEVA.md`](JEEVA.md).
- **Licence in the actual download is ODbL v1.0**, not CC BY-NC-SA as the website says.
- **Observation cutoff:** there is no scrape date in the data; it differs by state (most courts
  Jan–Feb 2019). `pipeline/src/tareekh/cutoff.py` estimates it from the data.

The original context below is unchanged.

## Purpose of this document

Preserve the agreed project direction and the context needed to continue in a new session.
This is an idea and scope document, not a claim that the dataset has been audited or the model built.

The project has two parts:

1. **OUTLIER:** the existing playable data-science detective game.
2. **The pipeline project:** a real-world dataset taken through EDA, preprocessing,
   model training, evaluation, and deployment. Users should be able to try the trained
   model and explore analytics at **`https://otlr.vercel.app/model`**.

The pipeline is a separate academic project presented through the same website.
It is not another game level or a pipeline-building mechanic inside the game.

## Selected idea: “How long will this court case take?”

Use historical Indian district-court records to study differences in case duration
and estimate the probability that a case is disposed of within a chosen period.
“Disposed of” means the recorded case has ended; it does not necessarily mean a trial
verdict, conviction, or acquittal.

The motivating question is understandable: given the court, case category, and
information available when a case is filed, what does historical evidence suggest
about its time to disposal?

The user wanted a distinctive, defensible project built on real messy data, rather
than a familiar tutorial dataset or an AI wrapper. Crop-price forecasting was rejected
as too generic. Court-case duration became the preferred direction. Do not promise
that no other student or researcher has done it.

OUTLIER teaches people to investigate evidence; the court project applies those
data-science skills to a real public-system question. The connection is thematic:
the game's generated fraud cases are not training data for this model.

## Proposed dataset and verification status

The proposed source is **Development Data Lab's Indian judicial data**, described
in the earlier research as roughly 81 million district-court cases filed during
2010–2018. Start with a manageable subset, preferably one state, rather than
downloading and processing everything.

Source leads from the earlier discussion:

- [Development Data Lab — Judicial data](https://www.devdatalab.org/judicial-data)
- [JusticeHub — E-Courts dataset 2010–2018](https://justicehub.in/dataset/e-courts-dataset-2010-2018)
- [Data for India — Using e-courts data](https://www.dataforindia.com/e-courts-data/)

**No actual court-data files have been inspected in this workspace as part of this
handoff.** Dataset size, schema, access, license, coverage, and observation cutoff
must be checked against the source and downloaded files before implementation.
The filing-year range alone does not establish the last date on which cases were observed.

Expected fields to verify include court/location identifiers, filing date, disposal
date, case type, acts/sections, and disposal category. Availability and coding may
differ across files. Do not design the final form around unverified columns.

Earlier research mentioned inconsistent legal names, disposal labels, missing dates,
and duplicate or related proceedings. Treat these as audit questions, not measured
properties of our eventual subset. Record our own counts and examples.

## What the public page should do

At **`/model`**, visitors should be able to:

- Select supported court/location and case-category inputs and run the trained model.
- See an interpretable result, such as the estimated probability of disposal within
  one year, alongside the historical cohort and data period it comes from.
- Explore case volumes, disposal patterns, duration distributions, missingness,
  and differences across supported categories and courts.
- Inspect model performance, baseline comparisons, sample sizes, and limitations.

Duration ranges or survival curves are desirable only if the modelling and evaluation
support them. Do not fabricate confidence intervals or present a historical estimate
as a reliable completion date for a present-day personal case.

Use aggregate records and categories; the demo does not need names, personal case
identifiers, document uploads, or a prediction of guilt.

## End-to-end pipeline

### 1. Acquire and audit

Confirm permission to use and redistribute the data, document provenance and download
date, inspect the schema, and choose a subset with enough coverage and usable dates.
Preserve raw files unchanged and keep large datasets out of Git.

### 2. Explore the raw data

Measure missing fields, invalid dates, duplicates, category frequencies, reporting
coverage, and pending-versus-disposed records. Compare filing cohorts and courts.
Show raw-data problems before showing the cleaned results.

### 3. Preprocess reproducibly

Parse dates, map coded fields through supplied lookup tables, standardise categories,
and document every exclusion or merge rule. Investigate unusually long durations
before removing them: a long-running case may be real, not an erroneous outlier.
Distinguish separate proceedings from true duplicates where the data allows it.

Fit learned preprocessing on training data only. Save the same transformations with
the model so inference uses the training-time rules.

### 4. Define a valid prediction target

**Pending cases are the main modelling challenge.** A case without a disposal date
has an unknown eventual duration. Excluding all such cases biases duration estimates
toward cases that finish sooner.

Preferred approach: survival analysis, which can account for right-censored records
when a defensible observation cutoff is available. Compare a simple survival baseline
with a suitable feature-based model.

If the course requires standard classifiers, use a precisely defined question such
as “disposed of within 365 days of filing.” Include only records whose outcome for
that horizon is observable. A case observed pending for less than a year is not
automatically a negative label. Confirm this target is feasible after the data audit.

Regression on completed cases can be an exploratory comparison, but must be labelled
as conditional on observed completion and cannot stand in for all-case duration.

### 5. Train and evaluate

Use filing-time features only. Disposal date, disposal outcome, and information added
later must not enter the prediction inputs. Split by filing time and keep linked or
duplicate records from leaking between splits where identifiable.

Start with a simple baseline. Select models based on the target and course requirements,
not on a need to include every algorithm in the syllabus. For classification, consider
logistic regression and a tree-based comparison; assess calibration and discrimination.
For survival modelling, use censoring-aware metrics and check their assumptions.

Report performance by time period and supported court/category where sample sizes
allow it. Keep the final test set separate from model selection. Document weaknesses
and avoid claiming useful predictions until the model improves on an appropriate baseline.

### 6. Deploy and explain

Export a versioned preprocessing-and-model artifact plus evaluation and aggregate
analytics outputs. Serve inference through an API consumed by the existing Next.js
site at `/model`. Validate supported inputs and show the dataset period and model version.

The exact API hosting arrangement is undecided. Check dependencies and memory before
sharing the game's backend process; the existing game deployment is not proof that
the new model will fit or that moved paths are deployment-safe.

## Repository boundaries

The previous session already moved the game into `game/`; those moves are currently
staged. The intended structure is:

```text
idse-game/
├── IDEA.md                 # This shared project context
├── game/                   # Existing game, already moved here
│   ├── web/                # Next.js; future /model page lives here
│   ├── backend/            # Existing game API
│   ├── notebooks/
│   └── docs/
└── pipeline/               # Proposed; not yet created at this handoff
    ├── data/               # Raw/interim/processed files; large files ignored
    ├── notebooks/          # Audit, EDA, modelling experiments
    ├── src/                # Reproducible preparation, training, evaluation
    ├── artifacts/          # Versioned model and preprocessing metadata
    └── reports/            # Data dictionary, figures, metrics, model card
```

`game/docs/IDEA.md` describes the original game.
`game/docs/PIPELINE_IDEA.md` describes earlier pipeline-themed gameplay ideas;
it is not the specification for this court-data project.

## First milestone and open decisions

The next implementation milestone is a **small dataset feasibility audit**: obtain
one manageable subset, verify its terms and dictionary, measure its quality, establish
the observation cutoff, and determine whether the target can be evaluated honestly.
Choose the state and final prediction target from that evidence.

Also confirm the exact course rubric, including required algorithms and whether
deployment and analytics are assessed. The quoted course context supports an
end-to-end real-world data project; the complete rubric has not been verified here.

For now, preserve the idea and context. Building the model, adding `/model`, changing
hosting configuration, and deploying are later implementation steps.
