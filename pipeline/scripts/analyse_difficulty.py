"""How hard each kind of case is to predict, where the time goes, and the dataset's columns.

Writes reports/difficulty.json. Run after train_within_1y.py.

    uv run python scripts/analyse_difficulty.py
"""

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from train_within_1y import one_hot, ordinal

from tareekh.difficulty import (
    EASY_TYPES,
    difficulty_table,
    hearing_gap,
    stage_days,
    stage_summary,
    stuck_at,
)
from tareekh.glossary import case_type_name
from tareekh.modelling import CLEAN, modelling_data

ARTIFACT = ROOT / "artifacts" / "within_1y"
COLUMNS = {  # what each raw column is and how the project uses it
    "ddl_case_id": ("Anonymous case id", "joins cases to their law and section"),
    "year": ("Filing year", "splitting into train and test"),
    "state_code": ("State", "filter to Tamil Nadu"),
    "dist_code": ("District", "model input"),
    "court_no": ("Court within the district", "cleaning only; a visitor can't know it"),
    "cino": ("eCourts case number", "not used"),
    "judge_position": ("Type of judge / court (free text)", "model input, after cleaning"),
    "female_defendant": ("Defendant's gender, inferred from name", "description only, kept out of the model"),
    "female_petitioner": ("Petitioner's gender, inferred from name", "description only, kept out of the model"),
    "female_adv_def": ("Defendant advocate's gender", "not used"),
    "female_adv_pet": ("Petitioner advocate's gender", "not used"),
    "type_name": ("Case type (code)", "model input"),
    "purpose_name": ("Purpose of the latest hearing (code)", "analysis of where cases get stuck; not an input (it is from after filing)"),
    "disp_name": ("How the case ended (code)", "the label"),
    "date_of_filing": ("Filing date", "the label and the split"),
    "date_of_decision": ("Decision date", "the label"),
    "date_first_list": ("First hearing date", "analysis of where time goes; not an input"),
    "date_last_list": ("Latest hearing date", "analysis of where time goes; not an input"),
    "date_next_list": ("Next listed hearing date", "analysis of where time goes; not an input"),
}


def dataset_card() -> list[dict]:
    raw = pd.concat([pd.read_parquet(CLEAN / f"cases_{y}.parquet") for y in (2015, 2016, 2017)],
                    ignore_index=True)
    rows = []
    for col, (meaning, use) in COLUMNS.items():
        text = raw[col].astype(str)
        rows.append({"column": col, "meaning": meaning, "use": use,
                     "blank_share": float((text == "").mean()),
                     "sentinel_share": float(text.str.startswith(("-9998", "-9999")).mean()),
                     "example": next((v for v in text.head(50) if v), "")})
    return rows


def contested_only_models(frame: pd.DataFrame, cats: list[str], nums: list[str]) -> dict:
    """Would a model trained only on the hard cases do better than the served one on them?"""
    part = frame[frame["within_1y"].notna() & ~frame["case_type"].isin(EASY_TYPES)]
    train, test = part[part.filing_year.isin([2015, 2016])], part[part.filing_year == 2017]
    y_train, y_test = train["within_1y"].astype(int), test["within_1y"].astype(int)
    cols = cats + nums
    out = {}
    for name, model in [
        ("logistic regression, trained on real disputes only",
         Pipeline([("prep", one_hot(cats, nums)), ("model", LogisticRegression(max_iter=3000))])),
        ("random forest, trained on real disputes only",
         Pipeline([("prep", ordinal(cats, nums)),
                   ("model", RandomForestClassifier(n_estimators=100, min_samples_leaf=300,
                                                    max_features="sqrt", n_jobs=2, random_state=0))])),
    ]:
        p = model.fit(train[cols], y_train).predict_proba(test[cols])[:, 1]
        out[name] = {"auc": float(roc_auc_score(y_test, p)),
                     "accuracy": float(((p >= 0.5) == (y_test == 1)).mean())}
    return out


def main() -> int:
    labelled = pd.read_parquet(CLEAN / "labelled.parquet")
    frame = modelling_data(labelled).frame
    meta = json.loads((ARTIFACT / "metadata.json").read_text())
    cats, nums = meta["categorical"], meta["numeric"]
    model = joblib.load(ARTIFACT / "model.joblib")
    test = frame[frame["within_1y"].notna() & (frame["filing_year"] == 2017)].copy()
    test["y"] = test["within_1y"].astype(int)
    test["p"] = model.predict_proba(test[cats + nums])[:, 1]
    table = difficulty_table(test)
    for row in table["by_type"]:
        row["name"] = case_type_name(row["case_type"])

    usable = labelled[(labelled["unusable"] == "") & labelled["filing_year"].between(2015, 2017)]
    hard = usable[~usable["type"].isin(EASY_TYPES)]
    stages = stage_days(hard)
    by_type = []
    for t, part in hard.groupby("type"):
        if len(part) >= 10_000:
            gap = hearing_gap(part)
            by_type.append({"case_type": t, "name": case_type_name(t),
                            **stage_summary(stages.loc[part.index]),
                            "median_gap_between_hearings": float(gap.median()) if len(gap) else None})
    gap = hearing_gap(hard)
    yes = test["y"] == 1
    observed = labelled.loc[test.index, "observed_days"]
    result = {
        "difficulty": table,
        "contested_only_models": contested_only_models(frame, cats, nums),
        "finished_within_a_year": {
            "outcomes": labelled.loc[test.index[yes], "group"].value_counts(normalize=True).round(4).to_dict(),
            "same_day_share_of_yes": float((observed[yes] == 0).mean()),
        },
        "stages": {"contested": {**stage_summary(stages),
                                 "median_gap_between_hearings": float(gap.median()),
                                 "gap_cases": len(gap)},
                   "by_type": sorted(by_type, key=lambda r: -r["cases"])},
        "stuck_at": {"cases_open": int(((~hard["ended"]) & hard["group"].ne("moved")).sum()),
                     "top": stuck_at(hard)},
        "dataset_card": dataset_card(),
    }
    (ROOT / "reports" / "difficulty.json").write_text(json.dumps(result, indent=2, default=float))
    print(json.dumps({k: v for k, v in result.items() if k != "dataset_card"}, indent=1, default=float)[:6000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
