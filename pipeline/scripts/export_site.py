"""Package what the /model site needs, from the same model and data as the reports.

Writes to artifacts/site/ and copies it into the game backend (game/backend/auditor/tareekh/
data/), which serves /api/model/*:
- model.joblib, metadata.json   the served model (scikit-learn 1.9.1, same as the backend)
- inputs.json                   districts, the common real "kinds of case" (case type + court
                                level + law + section, with plain-English names), and the
                                values a visitor can't know (each court's congestion at the end
                                of the data, last year's filings), plus the average contribution
                                of each input for the explanations
- test_cases.json               300 real 2017 cases the model never saw, with what happened
- analytics.json                the charts: from reports/analysis.json, within_1y_results.json
                                and experiments.json

    uv run python scripts/export_site.py
"""

import json
import shutil
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tareekh.courts import court_level
from tareekh.glossary import (
    CASE_TYPES,
    PURPOSE_PLAIN,
    TOPIC_NOUN,
    TOPICS,
    case_type_name,
    section_name,
    topic_of,
    variant_label,
)
from tareekh.modelling import CLEAN, district_names, modelling_data
from tareekh.survival import kaplan_meier, median_days, still_open_at

ARTIFACT = ROOT / "artifacts" / "within_1y"
SITE = ROOT / "artifacts" / "site"
BACKEND = ROOT.parent / "game" / "backend" / "auditor" / "tareekh" / "data"
REPORT = ROOT / "reports"
SEED = 0
N_KINDS = 40
N_TEST_CASES = 300
MILESTONES = [3, 6, 12, 24, 36, 48]  # months shown as "still open after …"


def kind_label(case_type: str, court: str, law: str, law_section: str) -> dict:
    section = law_section.split(" s.", 1)[1] if " s." in law_section else ""
    about = section_name(law, section) if section else None
    if about:
        title = about[0].upper() + about[1:]
        detail = f"{law} s.{section}"
    elif section:
        title, detail = f"{law} s.{section}", law
    else:
        title, detail = law if law != "not recorded" else "Law not recorded", "other sections"
    return {"title": title, "law_detail": detail, "case_type_name": case_type_name(case_type),
            "court_level": court}


def timing(observed_days: pd.Series, ended: pd.Series) -> dict:
    """Kaplan-Meier: median days to finish, and the share still open at each milestone."""
    curve = kaplan_meier(observed_days, ended)
    return {"cases": int(observed_days.notna().sum()), "median_days": median_days(curve),
            "still_open": dict(zip([str(m) for m in MILESTONES],
                                   still_open_at(curve, np.array(MILESTONES) * 30.44)
                                   .round(4).tolist(), strict=True))}


def group_slices(prep, cats: list[str], nums: list[str]) -> dict[str, slice]:
    """Which transformed columns belong to which input (one-hot blocks, then numerics)."""
    encoder = prep.named_transformers_["cat"]
    slices, start = {}, 0
    for col, categories in zip(cats, encoder.categories_, strict=True):
        slices[col] = slice(start, start + len(categories))
        start += len(categories)
    for col in nums:
        slices[col] = slice(start, start + 1)
        start += 1
    return slices


def contributions(model, rows: pd.DataFrame, cats, nums) -> pd.DataFrame:
    """Log-odds contribution of each input for each row (logistic regression only)."""
    prep, lr = model.named_steps["prep"], model.named_steps["model"]
    x = prep.transform(rows[cats + nums])
    x = x.toarray() if hasattr(x, "toarray") else np.asarray(x)
    weighted = x * lr.coef_[0]
    return pd.DataFrame({col: weighted[:, s].sum(axis=1) for col, s in
                         group_slices(prep, cats, nums).items()}, index=rows.index)


def latest_congestion(labelled: pd.DataFrame, names: dict[str, str]) -> list[dict]:
    """Each district × court level at the end of the data: cases pending at the cutoff and
    the share of that queue cleared in the year before (the model's congestion inputs)."""
    usable = labelled[labelled["unusable"] == ""].copy()
    usable["court_level"] = usable["judge_position"].map(court_level)
    end = usable["date_of_filing"] + pd.to_timedelta(usable["observed_days"], unit="D")
    gone = usable["ended"] | usable["group"].eq("moved")
    usable["end"] = end.where(gone)
    rows = []
    for (dist, level), part in usable.groupby(["dist_code", "court_level"]):
        cutoff = part["cutoff"].max()
        pending = ((part["date_of_filing"] <= cutoff)
                   & (part["end"].isna() | (part["end"] > cutoff))).sum()
        disposed = (part["end"].between(cutoff - pd.Timedelta(days=365), cutoff)).sum()
        rows.append({"district": names.get(dist, dist), "court_level": level,
                     "cutoff": str(cutoff.date()), "pending": int(pending),
                     "disposed_last_year": int(disposed),
                     "log_pending_at_filing": float(np.log1p(pending)),
                     "clearance_last_year": float(disposed / (pending + 1))})
    return rows


def main() -> int:
    metadata = json.loads((ARTIFACT / "metadata.json").read_text())
    model = joblib.load(ARTIFACT / "model.joblib")
    cats, nums = metadata["categorical"], metadata["numeric"]
    if "law" not in cats:
        raise SystemExit("the served model has no law inputs; retrain before exporting")
    labelled = pd.read_parquet(CLEAN / "labelled.parquet")
    names = district_names()
    frame = modelling_data(labelled).frame
    test = frame[frame["within_1y"].notna() & (frame["filing_year"] == 2017)]

    # the common real kinds of case, as the site's main input
    combo = ["case_type", "court_level", "law", "law_section"]
    groups = test.groupby(combo)
    kinds = (groups.agg(cases=("within_1y", "size"), within_1y=("within_1y", "mean"),
                        ipc_bailable=("ipc_bailable", lambda s: s.mode().iat[0]),
                        criminal=("criminal", lambda s: s.mode().iat[0]),
                        n_ipc_sections=("n_ipc_sections", "median"))
             .reset_index().sort_values("cases", ascending=False).head(N_KINDS))
    kinds = [{"id": f"k{i}", **{c: row[c] for c in combo},
              "ipc_bailable": row["ipc_bailable"], "criminal": row["criminal"],
              "n_ipc_sections": float(row["n_ipc_sections"]), "cases_2017": int(row["cases"]),
              "within_1y_2017": float(row["within_1y"]),
              **kind_label(row["case_type"], row["court_level"], row["law"], row["law_section"])}
             for i, (_, row) in enumerate(kinds.iterrows())]
    covered = sum(k["cases_2017"] for k in kinds) / len(test)

    # how long each kind and each topic usually takes (all usable filings 2015-2018)
    recent = frame[frame["filing_year"].between(2015, 2018)].join(
        labelled[["observed_days", "ended"]], how="left")
    recent["topic"] = [topic_of(c, law, ls) for c, law, ls in
                       zip(recent["case_type"], recent["law"], recent["law_section"], strict=True)]
    keyed = recent.set_index(combo).sort_index()
    for kind in kinds:
        part = keyed.loc[tuple(kind[c] for c in combo)]
        kind["timing"] = timing(part["observed_days"], part["ended"])
        kind["topic"] = topic_of(kind["case_type"], kind["law"], kind["law_section"])
        kind["variant"] = variant_label(kind["case_type"], kind["court_level"])
    eligible = recent[recent["within_1y"].notna() & (recent["filing_year"] <= 2017)]
    topics = []
    for topic in TOPICS:
        members = [k for k in kinds if k["topic"] == topic["id"]]
        if not members:
            continue
        part = recent[recent["topic"] == topic["id"]]
        topics.append({**topic, "noun": TOPIC_NOUN[topic["id"]],
                       "default_kind": max(members, key=lambda k: k["cases_2017"])["id"],
                       "kinds": [k["id"] for k in sorted(members, key=lambda k: -k["cases_2017"])],
                       "timing": timing(part["observed_days"], part["ended"]),
                       "within_1y": float(eligible.loc[eligible["topic"] == topic["id"],
                                                       "within_1y"].mean())})

    filings_2018 = (frame[frame["filing_year"] == 2018].groupby(["district", "case_type"])
                    .size().rename("n").reset_index())
    filings_2018["log_prev_year_filings"] = np.log1p(filings_2018["n"])

    sample = test.sample(min(50_000, len(test)), random_state=SEED)
    mean_contribution = contributions(model, sample, cats, nums).mean().to_dict()

    inputs = {
        "question": metadata["question"],
        "model": metadata["model"],
        "data": metadata["data"],
        "districts": sorted(test["district"].unique()),
        "months": [str(m) for m in range(1, 13)],
        "kinds": kinds, "kinds_cover_2017": covered, "topics": topics,
        "congestion": latest_congestion(labelled, names),
        "prev_year_filings": filings_2018[["district", "case_type", "log_prev_year_filings"]]
        .to_dict("records"),
        "mean_contribution": mean_contribution,
        "categorical": cats, "numeric": nums,
        "labels": {"district": "District", "court_level": "Court", "case_type": "Case type",
                   "filing_month": "Month filed", "law": "Law", "law_section": "Section",
                   "ipc_bailable": "Bailable or not (IPC)", "criminal": "Criminal or civil (as recorded in the data)",
                   "n_ipc_sections": "Number of IPC sections charged",
                   "log_prev_year_filings": "Similar cases filed in the district last year",
                   "log_pending_at_filing": "Cases already waiting in these courts",
                   "clearance_last_year": "How fast these courts cleared cases last year"},
    }

    picked = test.sample(N_TEST_CASES, random_state=SEED + 1)
    picked_lab = labelled.loc[picked.index]
    test_cases = []
    for idx, row in picked.iterrows():
        test_cases.append({
            "id": f"t{len(test_cases)}",
            **{c: (row[c] if c in cats else float(row[c])) for c in cats + nums},
            **kind_label(row["case_type"], row["court_level"], row["law"], row["law_section"]),
            "topic": topic_of(row["case_type"], row["law"], row["law_section"]),
            "variant": variant_label(row["case_type"], row["court_level"]),
            "filed": str(picked_lab.at[idx, "date_of_filing"].date()),
            "within_1y": int(row["within_1y"]),
            "ended": bool(picked_lab.at[idx, "ended"]),
            "observed_days": int(picked_lab.at[idx, "observed_days"]),
        })

    analysis = json.loads((REPORT / "analysis.json").read_text())
    results = json.loads((REPORT / "within_1y_results.json").read_text())
    experiments = json.loads((REPORT / "experiments.json").read_text())
    tn = analysis["tamil_nadu"]
    analytics = {
        "national": {"cases": analysis["national"]["cases"],
                     "monthly_decisions": analysis["national"]["monthly_decisions"],
                     "states": [s for s in analysis["national"]["states"]
                                if s["pending_2010_filings"] is not None and s["cases"] > 100_000]},
        "topics": topics,
        "tamil_nadu": {k: tn[k] for k in ("cases", "cleaning", "survivorship",
                                          "still_open_curves", "within_1y_by_year",
                                          "within_1y_by_district", "within_1y_by_type",
                                          "within_1y_by_court_level", "district_clusters")},
        "case_type_names": CASE_TYPES,
        "model": {"test": results["test"], "calibration": results["served"]["calibration_2017"],
                  "importance": results["served"]["permutation_importance_2017"],
                  "served": results["served"]["name"]},
        "experiments": {"horizons": experiments["horizons"], "drift": experiments["drift"],
                        "weak_case_types": experiments["weak_spots"]["case_type"][:8]},
    }

    predicted = model.predict_proba(test[cats + nums])[:, 1] >= 0.5
    actual = test["within_1y"].astype(int).to_numpy().astype(bool)
    tp, fp = int((predicted & actual).sum()), int((predicted & ~actual).sum())
    fn, tn = int((~predicted & actual).sum()), int((~predicted & ~actual).sum())
    confusion = {"tp": tp, "fp": fp, "fn": fn, "tn": tn, "precision": tp / (tp + fp),
                 "recall": tp / (tp + fn), "accuracy": (tp + tn) / len(test)}
    train_cases = int((frame["within_1y"].notna() & frame["filing_year"].isin([2015, 2016])).sum())
    model_info = {
        "name": "Logistic regression", "library": f"scikit-learn {metadata['scikit_learn']}",
        "target": "Disposed of within 365 days of filing (yes / no)",
        "n_inputs": len(cats) + len(nums),
        "train_cases": train_cases, "train_years": metadata["trained_on_filing_years"],
        "test_cases": len(test), "test_year": metadata["tested_on_filing_year"],
        "metrics": metadata["test_metrics"], "confusion": confusion,
        "file_bytes": metadata["model_bytes"],
        "base_rate": float(test["within_1y"].mean()),
    }
    difficulty = json.loads((REPORT / "difficulty.json").read_text())
    table = difficulty["difficulty"]
    model_info["trust"] = {
        "easy": table["easy"], "contested": table["contested"],
        "by_type": {r["case_type"]: r for r in table["by_type"]},
    }
    inputs["model_info"] = model_info
    analytics["difficulty"] = {
        "table": table,
        "contested_only_models": difficulty["contested_only_models"],
        "stages": difficulty["stages"],
        "stuck_at": {
            "cases_open": difficulty["stuck_at"]["cases_open"],
            "top": [{**s, "stage": PURPOSE_PLAIN.get(s["purpose"], s["purpose"])}
                    for s in difficulty["stuck_at"]["top"]],
        },
        "dataset_card": difficulty["dataset_card"],
    }
    analytics["model"]["info"] = model_info
    analytics["model"]["days_regression"] = json.loads(
        (REPORT / "days_regression.json").read_text())
    analytics["experiments"]["drift"] = experiments["drift"]

    SITE.mkdir(parents=True, exist_ok=True)
    shutil.copy(ARTIFACT / "model.joblib", SITE / "model.joblib")
    (SITE / "metadata.json").write_text(json.dumps(metadata, indent=2))
    for name, obj in [("inputs", inputs), ("test_cases", test_cases),
                      ("analytics", analytics)]:
        (SITE / f"{name}.json").write_text(json.dumps(obj, default=str))
    BACKEND.mkdir(parents=True, exist_ok=True)
    for f in SITE.iterdir():
        shutil.copy(f, BACKEND / f.name)
    sizes = {f.name: f"{f.stat().st_size / 1e3:.0f} kB" for f in sorted(SITE.iterdir())}
    print(f"{len(kinds)} kinds of case covering {covered:.0%} of 2017 cases; "
          f"{len(inputs['congestion'])} court groups; files: {sizes}; copied to {BACKEND}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
