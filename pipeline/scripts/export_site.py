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
from tareekh.glossary import CASE_TYPES, case_type_name, section_name
from tareekh.modelling import CLEAN, district_names, modelling_data

ARTIFACT = ROOT / "artifacts" / "within_1y"
SITE = ROOT / "artifacts" / "site"
BACKEND = ROOT.parent / "game" / "backend" / "auditor" / "tareekh" / "data"
REPORT = ROOT / "reports"
SEED = 0
N_KINDS = 40
N_TEST_CASES = 300


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
        "kinds": kinds, "kinds_cover_2017": covered,
        "congestion": latest_congestion(labelled, names),
        "prev_year_filings": filings_2018[["district", "case_type", "log_prev_year_filings"]]
        .to_dict("records"),
        "mean_contribution": mean_contribution,
        "categorical": cats, "numeric": nums,
        "labels": {"district": "District", "court_level": "Court", "case_type": "Case type",
                   "filing_month": "Month filed", "law": "Law", "law_section": "Section",
                   "ipc_bailable": "Bailable or not (IPC)", "criminal": "Criminal or civil",
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
