# Submission: How long do Indian district-court cases take?

**CS3006 Introduction to Data Science for Engineers · IIITDM Kancheepuram · November 2026**

An end-to-end data science project on real Indian court records: given only what is known on the
day a case is filed, will a Tamil Nadu district-court case be disposed of within a year?

| Member | Roll number |
|---|---|
| Yashvanth S | CS24I1029 |
| Jeevanandham T | CS24I1035 |
| Nithillakrishi PY | CS24I1039 |

## What is in this folder

| File | What it is |
|---|---|
| [`Court-Case-Duration-Report.pdf`](pipeline-report/Court-Case-Duration-Report.pdf) | The project report (LaTeX), with every stage: collection, cleaning, labelling, EDA, modelling, evaluation, deployment, limitations |
| [`pipeline-report/`](pipeline-report/) | The report's LaTeX source (`main.tex`); figures are read from `pipeline/reports/figures/` and `pipeline/docs/screenshots/` |
| [`Court-Case-Duration-Presentation.pptx`](Court-Case-Duration-Presentation.pptx) | The presentation, with speaker notes on every slide |
| [`Court-Case-Duration-Presentation.pdf`](Court-Case-Duration-Presentation.pdf) | The same presentation as a PDF |

**Try it live:** [otlr.vercel.app/model](https://otlr.vercel.app/model): choose a case, press
Analyze, and see the prediction, why, and every input the model was given. The whole pipeline, step
by step with its code, is at [otlr.vercel.app/model/pipeline](https://otlr.vercel.app/model/pipeline).

**The code:** [`pipeline/`](../pipeline/) (how to run every step: [`pipeline/README.md`](../pipeline/README.md);
the write-up in Markdown: [`pipeline/REPORT.md`](../pipeline/REPORT.md); the executed notebooks:
[`pipeline/notebooks/`](../pipeline/notebooks/)).

## The project in brief

- **Data:** Development Data Lab's de-identified eCourts records, 80,935,944 cases filed 2010–2018
  across India; 3,640,055 from Tamil Nadu. Licence ODbL v1.0.
- **Pipeline:** stream and CRC-check the 16 GB archive → clean 29,857 hand-typed law names, courts,
  sections and impossible dates → estimate each district's scrape date and label only cases watched
  for a full year → explore → three baselines against logistic regression, linear SVM and random
  forest → train on 2015, choose on 2016, test once on 2017 → serve the 6 kB logistic regression
  through FastAPI to the website.
- **Results on 549,273 unseen 2017 cases:**

  | | Cases | Model accuracy | Always guessing the commonest answer | AUC |
  |---|---|---|---|---|
  | All cases | 549,273 | 80.9% | 50.5% | 0.873 |
  | Easy cases (petty summary trials, bail-type petitions) | 196,105 | 92.6% | 88.1% | 0.903 |
  | **Real disputes** | **353,168** | **74.3%** | **72.0%** | **0.706** |

  The model beats a case type × district lookup table (AUC 0.873 vs 0.844, Brier 0.138 vs 0.163)
  and its probabilities are calibrated. Most of its accuracy comes from easy cases: on real
  disputes, filing-day information barely beats guessing.
- **What it is for:** planning (how many new cases will still be open next year, which kinds to
  steer towards mediation). It is not a prediction for one person's case, and not legal advice.
  Party gender is deliberately not an input.

## Contributions

The work was split into three equal shares, one per member.

| Member | Share | Contribution |
|---|---|---|
| **Yashvanth S** (CS24I1029) | 1/3 | Modelling and evaluation: the baselines, logistic regression, linear SVM and random forest, the time split, calibration, permutation importance, drift and the easy-cases vs real-disputes analysis; the served model and its API; deployment of the backend and the website |
| **Jeevanandham T** (CS24I1035) | 1/3 | Data collection and preparation: the streamed, CRC-checked download, the cleaning rules for laws, sections, courts, dates and dispositions with their tests, and labelling: the scrape-cutoff estimate, censoring and the early-year survivorship check |
| **Nithillakrishi PY** (CS24I1039) | 1/3 | Exploratory analysis: the EDA, Kaplan–Meier survival curves, k-means district clusters and the settlement analysis, the executed notebooks and figures, and the `/model` website pages |

All three members reviewed the report and the presentation and prepared for the viva together.

## Rebuild the report

```bash
cd submission/pipeline-report
tectonic main.tex          # writes main.pdf; https://tectonic-typesetting.github.io
```

## The game

The repository also holds **OUTLIER**, a detective game about catching fraud with data analysis.
Play it at **[otlr.vercel.app](https://otlr.vercel.app)**; everything about it is in the
[main README](../README.md).
