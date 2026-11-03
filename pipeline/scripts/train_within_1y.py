"""Train and evaluate "will this Tamil Nadu case be disposed of within one year of filing?".

Protocol (decided before looking at test results):
- Data: Tamil Nadu cases with a defined one-year label (filed at least a year before their
  court's scrape cutoff; moved-before-a-year cases excluded) — see tareekh.target.
- Years: 2010-2014 filings are left out (early years are incomplete: quickly finished cases from
  before digitisation are missing). Model selection: train on 2015, choose on 2016. Final: refit
  on 2015+2016, report once on 2017, a later year the models never saw.
- Baselines the models must beat: the overall rate, the rate per case type, and the rate per
  case type x district (a lookup table, which is what "college predictor"-style sites do).
- Models: logistic regression, linear SVM (calibrated to give probabilities), random forest.
  Each family gets a small grid; the family with the best 2016 log loss is the one served.

    uv run python scripts/train_within_1y.py
"""

import itertools
import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, f1_score, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tareekh.features import CATEGORICAL, FEATURES, NUMERIC, build, type_vocabulary

LABELLED = ROOT / "data" / "clean" / "10" / "labelled.parquet"
KEYS = ROOT / "data" / "raw" / "ddl" / "keys"
ARTIFACT = ROOT / "artifacts" / "within_1y"
REPORT = ROOT / "reports"
SEED = 0


def metrics(y: np.ndarray, p: np.ndarray) -> dict:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {"n": len(y), "positive_rate": float(y.mean()), "auc": roc_auc_score(y, p),
            "brier": brier_score_loss(y, p), "log_loss": log_loss(y, p),
            "accuracy": accuracy_score(y, p >= 0.5), "f1": f1_score(y, p >= 0.5)}


def y_of(part: pd.DataFrame) -> np.ndarray:
    return part["within_1y"].to_numpy().astype(int)


def lookup(train: pd.DataFrame, test: pd.DataFrame, keys: list[str], prior: int = 20
           ) -> np.ndarray:
    """Rate per group from training data, shrunk towards the overall rate for small groups."""
    overall = train["within_1y"].mean()
    stats = train.groupby(keys)["within_1y"].agg(["sum", "count"])
    rate = (stats["sum"] + prior * overall) / (stats["count"] + prior)
    joined = test[keys].merge(rate.rename("rate"), how="left", left_on=keys, right_index=True)
    return joined["rate"].fillna(overall).to_numpy()


def one_hot() -> ColumnTransformer:
    return ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ("num", StandardScaler(), NUMERIC),
    ])


def ordinal() -> ColumnTransformer:
    return ColumnTransformer([
        ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), CATEGORICAL),
        ("num", "passthrough", NUMERIC),
    ])


CANDIDATES = {
    "logistic regression": [
        {"C": c, "make": lambda c=c: Pipeline([
            ("prep", one_hot()), ("model", LogisticRegression(C=c, max_iter=2000))])}
        for c in (0.1, 1.0, 10.0)],
    "linear SVM (calibrated)": [
        {"C": c, "make": lambda c=c: Pipeline([
            ("prep", one_hot()),
            ("model", CalibratedClassifierCV(LinearSVC(C=c, dual=False), method="sigmoid",
                                             cv=3))])}
        for c in (0.01, 0.1)],
    # max_features=None lets every split consider case type and district together (with "sqrt"
    # only 2-3 of the inputs are tried per split, and the forest lost to a lookup table)
    "random forest": [
        {"min_samples_leaf": leaf, "max_features": mf, "make": lambda leaf=leaf, mf=mf: Pipeline([
            ("prep", ordinal()),
            ("model", RandomForestClassifier(n_estimators=100, min_samples_leaf=leaf,
                                             max_features=mf, n_jobs=-1,
                                             random_state=SEED))])}
        for leaf, mf in ((300, "sqrt"), (300, None), (1000, None))],
}


def district_names() -> dict[str, str]:
    key = pd.read_csv(KEYS / "cases_district_key.csv", dtype=str, keep_default_na=False)
    key = key[key["state_code"] == "10"].sort_values("year")
    return dict(zip(key["dist_code"], key["district_name"], strict=True))


def calibration_table(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for lo, hi in itertools.pairwise(edges):
        m = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        if m.sum():
            rows.append({"predicted": f"{lo:.1f}-{hi:.1f}", "cases": int(m.sum()),
                         "mean_predicted": float(p[m].mean()), "observed": float(y[m].mean())})
    return rows


def write_markdown(results: dict, metadata: dict, path: Path) -> None:
    """The results as a readable report, regenerated on every run so it never goes stale."""
    def table(rows: dict) -> list[str]:
        out = ["| | AUC | Brier | log loss | accuracy | cases |", "|---|---|---|---|---|---|"]
        for name, m in rows.items():
            out.append(f"| {name} | {m['auc']:.3f} | {m['brier']:.3f} | {m['log_loss']:.3f} | "
                       f"{m['accuracy']:.3f} | {m['n']:,} |")
        return out

    served = results["served"]
    lines = [
        "# Disposed of within a year? Tamil Nadu district courts",
        "",
        "Generated by `scripts/train_within_1y.py`; do not edit by hand.",
        "",
        f"- **Question:** {metadata['question']}.",
        f"- **Data:** {metadata['data']}.",
        ("- **Train:** filings of 2015-2016. **Test:** filings of 2017, used once, after the "
         "model was chosen on 2016 (train 2015 -> choose on 2016 -> refit 2015-2016)."),
        f"- **Served model:** {metadata['model']} ({metadata['model_bytes'] / 1e3:.0f} kB).",
        "- Lower Brier and log loss = better probabilities; AUC = how well cases are ranked.",
        "",
        "## Test year (2017 filings, unseen)",
        "",
        *table(results["test"]),
        "",
        "## Model selection (train 2015, score on 2016)",
        "",
        *table(results["selection"]),
        "",
        "## Is a predicted 70% really 70%? (2017, served model)",
        "",
        "| predicted | cases | mean predicted | observed |",
        "|---|---|---|---|",
        *[f"| {r['predicted']} | {r['cases']:,} | {r['mean_predicted']:.3f} | {r['observed']:.3f} |"
          for r in served["calibration_2017"]],
        "",
        "## What the model relies on (permutation importance, 2017, log loss increase)",
        "",
        "| input | importance |",
        "|---|---|",
        *[f"| {k} | {v['mean']:.4f} |" for k, v in sorted(
            served["permutation_importance_2017"].items(), key=lambda kv: -kv[1]["mean"])],
        "",
    ]
    path.write_text("\n".join(lines))


def main() -> int:
    started = time.monotonic()
    labelled = pd.read_parquet(LABELLED)
    # unusable rows (bad dates) are left out of everything, congestion counts included: a case
    # "decided before filing" has no trustworthy end date and would otherwise count as pending
    labelled = labelled[labelled["unusable"] == ""]
    train_types = labelled.loc[labelled["filing_year"].isin([2015, 2016]), "type"]
    vocabulary = type_vocabulary(train_types)
    frame = build(labelled, district_names(), vocabulary)
    frame = frame[frame["within_1y"].notna() & frame["filing_year"].between(2015, 2017)]
    fit_part, choose_part = frame[frame.filing_year == 2015], frame[frame.filing_year == 2016]
    final_train, test = frame[frame.filing_year <= 2016], frame[frame.filing_year == 2017]
    print(f"rows: train-for-selection {len(fit_part):,}, selection {len(choose_part):,}, "
          f"final train {len(final_train):,}, test {len(test):,}", flush=True)

    results: dict = {"baselines": {}, "selection": {}, "test": {}}
    for name, keys in [("overall rate", None), ("rate per case type", ["case_type"]),
                       ("rate per case type x district", ["case_type", "district"])]:
        if keys is None:
            p_choose = np.full(len(choose_part), fit_part["within_1y"].mean())
            p_test = np.full(len(test), final_train["within_1y"].mean())
        else:
            p_choose = lookup(fit_part, choose_part, keys)
            p_test = lookup(final_train, test, keys)
        results["selection"][name] = metrics(y_of(choose_part), p_choose)
        results["test"][name] = metrics(y_of(test), p_test)

    best: dict[str, dict] = {}
    for family, grid in CANDIDATES.items():
        for params in grid:
            t = time.monotonic()
            model = params["make"]().fit(fit_part[FEATURES], y_of(fit_part))
            score = metrics(y_of(choose_part), model.predict_proba(choose_part[FEATURES])[:, 1])
            label = ", ".join(f"{k}={v}" for k, v in params.items() if k != "make")
            results["selection"][f"{family} ({label})"] = score
            print(f"  {family} ({label}): 2016 log loss {score['log_loss']:.4f}, "
                  f"AUC {score['auc']:.4f} ({time.monotonic() - t:.0f}s)", flush=True)
            if family not in best or score["log_loss"] < best[family]["score"]["log_loss"]:
                best[family] = {"params": params, "label": label, "score": score}

    served_family = min(best, key=lambda f: best[f]["score"]["log_loss"])
    final_models = {}
    for family, choice in best.items():
        model = choice["params"]["make"]().fit(final_train[FEATURES], y_of(final_train))
        p = model.predict_proba(test[FEATURES])[:, 1]
        results["test"][f"{family} ({choice['label']})"] = metrics(y_of(test), p)
        final_models[family] = (model, p)
        print(f"  final {family}: 2017 AUC {results['test'][f'{family} ({choice['label']})']['auc']:.4f}",
              flush=True)

    model, p_test = final_models[served_family]
    sample = test.sample(min(50_000, len(test)), random_state=SEED)
    importance = permutation_importance(model, sample[FEATURES], y_of(sample),
                                        scoring="neg_log_loss", n_repeats=3,
                                        random_state=SEED, n_jobs=1)
    results["served"] = {
        "family": served_family, "params": best[served_family]["label"],
        "calibration_2017": calibration_table(y_of(test), p_test),
        "permutation_importance_2017": {
            f: {"mean": float(m), "std": float(s)} for f, m, s in
            zip(FEATURES, importance.importances_mean, importance.importances_std, strict=True)},
    }

    ARTIFACT.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, ARTIFACT / "model.joblib", compress=3)
    metadata = {
        "question": "Disposed of within 365 days of filing (Tamil Nadu district courts)",
        "data": "Development Data Lab judicial data (eCourts, 2010-2018), ODbL v1.0",
        "trained_on_filing_years": [2015, 2016], "tested_on_filing_year": 2017,
        "features": FEATURES, "case_types": vocabulary,
        "districts": sorted(frame["district"].unique()),
        "court_levels": sorted(frame["court_level"].unique()),
        "model": f"{served_family} ({best[served_family]['label']})",
        "scikit_learn": sklearn.__version__,
        "test_metrics": results["test"][f"{served_family} ({best[served_family]['label']})"],
        "model_bytes": (ARTIFACT / "model.joblib").stat().st_size,
    }
    (ARTIFACT / "metadata.json").write_text(json.dumps(metadata, indent=2))
    REPORT.mkdir(exist_ok=True)
    (REPORT / "within_1y_results.json").write_text(json.dumps(results, indent=2, default=float))
    write_markdown(results, metadata, REPORT / "within_1y.md")
    print(f"served: {served_family}; model file {metadata['model_bytes'] / 1e6:.1f} MB; "
          f"{time.monotonic() - started:.0f}s total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
