"""Follow-up experiments on the served model (logistic regression, "+ law and section").

1. Drift: courts got faster each year, so a model trained on 2015-16 under-predicts 2017.
   Compare training on 2015-16 (served), on 2016 only, and on 2015-16 with 2016 weighted 3x.
2. Horizons: the same model for "within 6 months" and "within 2 years". A horizon needs every
   labelled case to have been watched that long, so each horizon uses the latest years that
   allow it (2 years: train 2014-15, test 2016).
3. Cutoff rule: labels from the looser cutoff (share 0.25) instead of 0.5.
4. Where the model is weak: 2017 AUC and calibration per case type and per district.

Writes reports/experiments.json and reports/experiments.md. Light on CPU (linear models only).

    uv run python scripts/experiments.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tareekh.cases import decode
from tareekh.cutoff import cutoffs, with_fallback
from tareekh.features import FEATURE_SETS
from tareekh.modelling import CLEAN, modelling_data
from tareekh.target import label

sys.path.insert(0, str(ROOT / "scripts"))
from train_within_1y import one_hot

REPORT = ROOT / "reports"
CATS, NUMS = FEATURE_SETS["+ law and section"]
COLS = CATS + NUMS


def model() -> Pipeline:
    return Pipeline([("prep", one_hot(CATS, NUMS)),
                     ("model", LogisticRegression(C=1.0, max_iter=3000))])


def score(y: np.ndarray, p: np.ndarray) -> dict:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {"n": len(y), "auc": float(roc_auc_score(y, p)) if len(set(y)) > 1 else None,
            "brier": float(brier_score_loss(y, p)), "log_loss": float(log_loss(y, p, labels=[0, 1])),
            "mean_predicted": float(p.mean()), "observed": float(y.mean())}


def split(frame: pd.DataFrame, train_years, test_year):
    usable = frame[frame["within_1y"].notna()]
    train = usable[usable["filing_year"].isin(train_years)]
    test = usable[usable["filing_year"] == test_year]
    return train, test, train["within_1y"].astype(int).to_numpy(), test["within_1y"].astype(
        int).to_numpy()


def drift(frame: pd.DataFrame) -> dict:
    out = {}
    train, test, y_train, y_test = split(frame, (2015, 2016), 2017)
    for name, rows, weight in [
        ("train 2015-16 (served)", train["filing_year"].isin([2015, 2016]), None),
        ("train 2016 only", train["filing_year"] == 2016, None),
        ("train 2015-16, 2016 weighted 3x", train["filing_year"].isin([2015, 2016]),
         np.where(train["filing_year"] == 2016, 3.0, 1.0)),
    ]:
        m = model()
        fit_kwargs = {}
        if weight is not None:
            fit_kwargs["model__sample_weight"] = weight[rows.to_numpy()]
        m.fit(train.loc[rows, COLS], y_train[rows.to_numpy()], **fit_kwargs)
        out[name] = score(y_test, m.predict_proba(test[COLS])[:, 1])
        print(f"  drift | {name}: {out[name]}", flush=True)
    return out


def horizons(labelled: pd.DataFrame) -> dict:
    out = {}
    for days, train_years, test_year in [(180, (2015, 2016), 2017), (365, (2015, 2016), 2017),
                                         (730, (2014, 2015), 2016)]:
        frame = modelling_data(labelled, horizon_days=days).frame
        train, test, y_train, y_test = split(frame, train_years, test_year)
        m = model().fit(train[COLS], y_train)
        base = train.groupby("case_type")["within_1y"].mean()
        p_base = test["case_type"].map(base).fillna(y_train.mean()).to_numpy()
        out[f"{days} days"] = {"train": list(train_years), "test": test_year,
                               "model": score(y_test, m.predict_proba(test[COLS])[:, 1]),
                               "baseline: rate per case type": score(y_test, p_base)}
        print(f"  horizon {days}: {out[f'{days} days']['model']}", flush=True)
    return out


def cutoff_rule() -> dict:
    files = sorted((CLEAN).glob("cases_*.parquet"))
    cases = decode(pd.concat([pd.read_parquet(f) for f in files], ignore_index=True))
    out = {}
    for share in (0.25, 0.5):
        state = cutoffs(cases, by="state_code", share=share)
        dist = with_fallback(cutoffs(cases, by=["state_code", "dist_code"], share=share), state,
                             parent_of=lambda k: k[0])
        per_case = pd.Series([dist.get(k) for k in zip(cases["state_code"], cases["dist_code"],
                                                       strict=True)], index=cases.index)
        lab = label(cases, per_case)
        lab["filing_year"] = lab["date_of_filing"].dt.year
        frame = modelling_data(lab).frame
        train, test, y_train, y_test = split(frame, (2015, 2016), 2017)
        m = model().fit(train[COLS], y_train)
        out[f"share {share}"] = {
            "district_cutoffs": {str(k.date()): int(v) for k, v in
                                 dist.value_counts().sort_index().items()},
            "within_1y_by_year": frame.groupby("filing_year")["within_1y"].mean().round(4)
            .dropna().to_dict(),
            "model_2017": score(y_test, m.predict_proba(test[COLS])[:, 1]),
        }
        print(f"  cutoff share {share}: {out[f'share {share}']['model_2017']}", flush=True)
    return out


def weak_spots(frame: pd.DataFrame) -> dict:
    train, test, y_train, _ = split(frame, (2015, 2016), 2017)
    test = test.assign(p=model().fit(train[COLS], y_train).predict_proba(test[COLS])[:, 1])
    out = {}
    for col in ("case_type", "district", "court_level", "law"):
        rows = []
        for value, part in test.groupby(col):
            if len(part) < 2000:
                continue
            s = score(part["within_1y"].astype(int).to_numpy(), part["p"].to_numpy())
            rows.append({col: value, **s})
        out[col] = sorted(rows, key=lambda r: (r["auc"] is None, r["auc"] or 0))
    return out


def markdown(results: dict) -> str:
    def row(name, s):
        auc = "n/a" if s["auc"] is None else f"{s['auc']:.3f}"
        return (f"| {name} | {auc} | {s['brier']:.3f} | {s['log_loss']:.3f} | "
                f"{s['mean_predicted']:.3f} | {s['observed']:.3f} | {s['n']:,} |")

    head = ["| | AUC | Brier | log loss | mean predicted | observed | cases |",
            "|---|---|---|---|---|---|---|"]
    lines = ["# Experiments on the served model", "",
             "Generated by `scripts/experiments.py`; do not edit by hand.", "",
             "## 1. Drift (test: 2017 filings)", "", *head,
             *[row(k, v) for k, v in results["drift"].items()], "",
             "## 2. Other horizons", "", *head]
    for name, h in results["horizons"].items():
        lines.append(row(f"{name}: model (train {h['train']}, test {h['test']})", h["model"]))
        lines.append(row(f"{name}: rate per case type", h["baseline: rate per case type"]))
    lines += ["", "## 3. Cutoff rule (share of a normal month that still counts as observed)",
              "", *head]
    for name, c in results["cutoff_rule"].items():
        lines.append(row(f"{name} (district cutoffs {c['district_cutoffs']})", c["model_2017"]))
    lines += ["", ("## 4. Where the model is weakest (2017, groups with ≥ 2,000 cases, "
                   "lowest AUC first)"), ""]
    for col, rows in results["weak_spots"].items():
        lines += [f"### by {col}", "", *head,
                  *[row(r[col], r) for r in rows[:8]], ""]
    return "\n".join(lines)


def main() -> int:
    labelled = pd.read_parquet(CLEAN / "labelled.parquet")
    frame = modelling_data(labelled).frame
    results = {"drift": drift(frame), "horizons": horizons(labelled),
               "cutoff_rule": cutoff_rule(), "weak_spots": weak_spots(frame)}
    REPORT.mkdir(exist_ok=True)
    (REPORT / "experiments.json").write_text(json.dumps(results, indent=2, default=str))
    (REPORT / "experiments.md").write_text(markdown(results))
    print(markdown(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
