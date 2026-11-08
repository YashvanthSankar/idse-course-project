"""Can filing-day facts tell how a real dispute will end? Writes reports/settlement.json.

Every case is watched for two full years. Train on 2015 filings, test on 2016 filings: later
years don't have two years of follow-up. Each model is compared with plain lookup tables.

    uv run python scripts/analyse_settlement.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tareekh.acts import canonical_act
from tareekh.courts import court_level
from tareekh.difficulty import EASY_TYPES
from tareekh.glossary import case_type_name
from tareekh.settlement import ended_as, lookup_rates, top_decile_precision

CLEAN = ROOT / "data" / "clean" / "10"
KEYS = ROOT / "data" / "raw" / "ddl" / "keys"
REPORT = ROOT / "reports" / "settlement.json"
HORIZON = 730
TRAIN_YEAR, TEST_YEAR = 2015, 2016
WITHIN_TYPES = ["cc", "mcop", "os"]
FEATURES = ["case_type", "district", "court", "law"]
COLUMNS = ["ddl_case_id", "dist_code", "judge_position", "type", "group", "unusable", "cutoff",
           "observed_days", "ended", "filing_year", "date_of_filing"]


def load() -> pd.DataFrame:
    df = pd.read_parquet(CLEAN / "labelled.parquet", columns=COLUMNS)
    df = df[df["filing_year"].isin([TRAIN_YEAR, TEST_YEAR])].copy()
    df["case_type"] = df["type"].astype(str).str.strip().str.lower()
    df = df[~df["case_type"].isin(EASY_TYPES)]
    acts = pd.read_parquet(CLEAN / "acts_sections.parquet", columns=["ddl_case_id", "act"])
    names = pd.read_csv(KEYS / "act_key.csv", dtype=str, keep_default_na=False).set_index("act")["act_s"]
    raw = acts["act"].map(names).fillna("")
    canonical = {name: canonical_act(name) for name in raw.unique()}
    acts["law"] = raw.map(canonical)
    df = df.merge(acts[["ddl_case_id", "law"]].drop_duplicates("ddl_case_id"), on="ddl_case_id", how="left")
    df["law"] = df["law"].fillna("not recorded").astype(str)
    positions = df["judge_position"].astype(str)
    levels = {p: court_level(p) for p in positions.unique()}
    df["court"] = positions.map(levels).astype(str)
    df["district"] = df["dist_code"].astype(str)
    counts = df["case_type"].value_counts()
    df["case_type"] = df["case_type"].where(df["case_type"].isin(counts[counts >= 200].index), "other")
    return df


def logistic(train: pd.DataFrame, test: pd.DataFrame, target: str) -> np.ndarray:
    encoder = ColumnTransformer([("cats", OneHotEncoder(handle_unknown="ignore", min_frequency=50), FEATURES)])
    model = make_pipeline(encoder, LogisticRegression(max_iter=300, C=1.0))
    model.fit(train[FEATURES], train[target])
    return model.predict_proba(test[FEATURES])[:, 1]


def scores(y: np.ndarray, p: np.ndarray) -> dict:
    return {"auc": float(roc_auc_score(y, p)), "accuracy": float(((p >= 0.5) == (y == 1)).mean()),
            "top_decile_precision": top_decile_precision(y, p)}


def evaluate(frame: pd.DataFrame, target: str) -> tuple[dict, pd.DataFrame, np.ndarray]:
    train, test = frame[frame["filing_year"] == TRAIN_YEAR], frame[frame["filing_year"] == TEST_YEAR]
    y = test[target].to_numpy()
    p = logistic(train, test, target)
    base = float(y.mean())
    return ({"n_train": len(train), "n_test": len(test), "base_rate": base,
             "always_guessing_accuracy": max(base, 1 - base),
             "lookup_case_type": scores(y, lookup_rates(train, test, ["case_type"], target)),
             "lookup_case_type_and_law": scores(y, lookup_rates(train, test, ["case_type", "law"], target)),
             "logistic_regression": scores(y, p)}, test, p)


def main() -> int:
    df = load()
    report: dict = {"horizon_days": HORIZON, "train_year": TRAIN_YEAR, "test_year": TEST_YEAR,
                    "features": FEATURES, "targets": {}, "within_case_type": {}}
    eligible = None
    for group in ("dismissed", "settled"):
        df[group] = ended_as(df, group, HORIZON)
        eligible = df[df[group].notna()]
        result, test, p = evaluate(eligible, group)
        report["targets"][group] = result
        y = test[group].to_numpy()
        for t in WITHIN_TYPES:
            part = (test["case_type"] == t).to_numpy()
            report["within_case_type"].setdefault(t, {"name": case_type_name(t), "n": int(part.sum())})[group] = {
                "base_rate": float(y[part].mean()), "auc": float(roc_auc_score(y[part], p[part]))}

    # What scoring only the finished cases would have claimed
    finished = df[(df["unusable"] == "") & df["ended"]].copy()
    finished["finished_dismissed"] = finished["group"].eq("dismissed").astype(int)
    trap, _, _ = evaluate(finished, "finished_dismissed")
    report["finished_cases_only_dismissed"] = {"always_guessing_accuracy": trap["always_guessing_accuracy"],
                                               **trap["logistic_regression"]}

    by_type = eligible.groupby("case_type").agg(cases=("settled", "size"), dismissed=("dismissed", "mean"),
                                                settled=("settled", "mean"))
    report["by_case_type"] = [{"case_type": t, "name": case_type_name(t), "cases": int(r.cases),
                               "dismissed": float(r.dismissed), "settled": float(r.settled)}
                              for t, r in by_type.sort_values("cases", ascending=False).head(8).iterrows()]
    cc = eligible[eligible["case_type"] == "cc"]
    by_law = cc.groupby("law").agg(cases=("settled", "size"), settled=("settled", "mean"))
    report["criminal_calendar_by_law"] = [{"law": law, "cases": int(r.cases), "settled": float(r.settled)}
                                          for law, r in by_law.sort_values("cases", ascending=False).head(3).iterrows()]
    REPORT.write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report["targets"], indent=1))
    print(json.dumps(report["within_case_type"], indent=1))
    print(json.dumps(report["finished_cases_only_dismissed"], indent=1))
    print(report["criminal_calendar_by_law"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
