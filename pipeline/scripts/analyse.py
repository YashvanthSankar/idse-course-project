"""Every number the EDA notebooks and the /model analytics page show, computed in one place.

Writes reports/analysis.json (read by the notebooks' summary cells and by export_site.py) and
reports/analysis.md (a readable digest). Run after label_cases.py.

    uv run python scripts/analyse.py
"""

import glob
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from courtcases.acts import UNKNOWN, canonical_act
from courtcases.clusters import choose_and_fit
from courtcases.courts import court_level
from courtcases.cutoff import cutoffs, monthly_counts
from courtcases.sections import primary_section
from courtcases.survival import kaplan_meier, median_days, still_open_at

CLEAN = ROOT / "data" / "clean"
KEYS = ROOT / "data" / "raw" / "ddl" / "keys"
REPORT = ROOT / "reports"
MAIN_TYPES = ["stc", "os", "cc", "mcop", "crlmp", "ep", "hmop", "op"]
TYPE_NAMES = {  # Tamil Nadu abbreviations (see the glossary in pipeline/README.md)
    "stc": "Summary trial case (petty offences)", "os": "Original suit (civil)",
    "cc": "Calendar case (criminal, magistrate)", "mcop": "Motor accident claim",
    "crlmp": "Criminal miscellaneous petition (bail etc.)", "ep": "Execution petition",
    "hmop": "Hindu marriage petition", "op": "Original petition",
}


def key(name: str) -> pd.DataFrame:
    return pd.read_csv(KEYS / name, dtype=str, keep_default_na=False)


def national() -> dict:
    cols = ["state_code", "date_of_filing", "date_of_decision", "disp_name"]
    parts = []
    for f in sorted(glob.glob(str(CLEAN / "national" / "cases_*.parquet"))):
        part = pd.read_parquet(f, columns=cols)
        part["state_code"] = part["state_code"].astype(str)
        parts.append(part)
    nat = pd.concat(parts, ignore_index=True)
    for c in ("date_of_filing", "date_of_decision"):
        nat[c] = pd.to_datetime(nat[c])
    names = key("cases_state_key.csv").drop_duplicates("state_code").set_index(
        "state_code")["state_name"]
    cut = cutoffs(nat, by="state_code", share=0.5)
    # A cliff before mid-2018 in a small state is a dip, not the scrape (J&K and Mizoram came
    # out as 2012 and 2014): those states get no cutoff and no pending share
    cut = cut.where(cut >= pd.Timestamp("2018-06-01"))
    nat["year"] = nat["date_of_filing"].dt.year
    nat["cutoff"] = nat["state_code"].map(cut)
    open_at_cutoff = nat["date_of_decision"].isna() | (nat["date_of_decision"] > nat["cutoff"])
    states = []
    for code, part in nat.groupby("state_code"):
        if code not in names:
            continue
        y2010, y2015 = part["year"] == 2010, part["year"] == 2015
        reliable = pd.notna(cut.get(code)) and y2010.sum() >= 1000
        states.append({
            "code": code, "state": names[code], "cases": len(part),
            "cutoff": str(cut[code].date()) if pd.notna(cut.get(code)) else None,
            "pending_2010_filings": float(open_at_cutoff[part.index][y2010].mean())
            if reliable else None,
            "pending_2015_filings": float(open_at_cutoff[part.index][y2015].mean())
            if reliable else None,
        })
    monthly = monthly_counts(nat["date_of_decision"]).loc["2016-01":"2020-12"]
    return {
        "cases": len(nat),
        "cases_per_year": nat.groupby("year").size().to_dict(),
        "states": sorted(states, key=lambda s: -(s["pending_2010_filings"] or -1)),
        "monthly_decisions": {str(k): int(v) for k, v in monthly.items()},
    }


def tamil_nadu() -> dict:
    lab = pd.read_parquet(CLEAN / "10" / "labelled.parquet")
    out: dict = {"cases": len(lab)}
    names = key("cases_district_key.csv")
    names = dict(zip(names.loc[names.state_code == "10", "dist_code"],
                     names.loc[names.state_code == "10", "district_name"], strict=False))
    lab["district"] = lab["dist_code"].map(names).fillna(lab["dist_code"])
    lab["court_level"] = lab["judge_position"].map(court_level)

    # --- the mess, before and after -------------------------------------------------------
    acts_key = key("act_key.csv")
    acts_key["count"] = pd.to_numeric(acts_key["count"])
    acts_key["law"] = acts_key["act_s"].map(canonical_act)
    rows = acts_key["count"].sum()
    out["cleaning"] = {
        "raw_law_names": len(acts_key),
        "canonical_laws": int(acts_key.loc[~acts_key.law.isin([UNKNOWN, "Other"]), "law"]
                              .nunique()),
        "law_rows_named": float(acts_key.loc[~acts_key.law.isin([UNKNOWN, "Other"]),
                                             "count"].sum() / rows),
        "raw_court_names": int(lab["judge_position"].nunique()),
        "court_levels": int(lab["court_level"].nunique()),
        "decided_before_filing": int(lab["decided_before_filing"].sum()),
        "impossible_dates": {c: int(lab[f"{c}_impossible"].sum()) for c in
                             ["date_of_decision", "date_first_list", "date_last_list",
                              "date_next_list"]},
        "gender_unclear": {"defendant": float((lab["defendant"] == "unclear").mean()),
                           "petitioner": float((lab["petitioner"] == "unclear").mean())},
        "outcome_groups": lab["group"].value_counts(normalize=True).round(4).to_dict(),
    }
    acts = pd.read_parquet(CLEAN / "10" / "acts_sections.parquet", columns=["act", "section"])
    act_name = acts_key.set_index("act")["act_s"]
    section_name = key("section_key.csv").set_index("section")["section_s"]
    acts["law"] = acts["act"].map(act_name).fillna("").map(canonical_act)
    raw_sections = acts["section"].map(section_name).fillna("")
    out["cleaning"]["section_strings"] = {
        law: {"raw": int(raw_sections[acts.law == law].nunique()),
              "after": int(raw_sections[acts.law == law].map(primary_section).nunique())}
        for law in ["Indian Penal Code", "Negotiable Instruments Act", "Motor Vehicles Act",
                    "Code of Civil Procedure"]}

    # --- survivorship: early years are incomplete -----------------------------------------
    lab["court"] = lab["dist_code"] + "-" + lab["court_no"]
    first = lab.groupby("court")["filing_year"].min()
    old = first[first == 2010].index
    same_courts = lab[lab["court"].isin(old)].groupby("filing_year").size()
    out["survivorship"] = {
        "courts_present_2010": len(old), "courts_total": len(first),
        "cases_in_those_courts": {int(k): int(v) for k, v in same_courts.items()},
        "same_day_share": lab.groupby("filing_year")["observed_days"].apply(
            lambda s: float((s == 0).mean())).to_dict(),
        "median_days_among_decided": lab[lab["ended"]].groupby("filing_year")[
            "observed_days"].median().to_dict(),
    }

    # --- still-open curves (2015-2018 filings: the complete years) --------------------------
    recent = lab[(lab["unusable"] == "") & lab["filing_year"].between(2015, 2018)]
    months = list(range(0, 49, 3))
    curves = {}
    for name, part in [("all cases", recent)] + [(t, recent[recent["type"] == t])
                                                 for t in MAIN_TYPES]:
        km = kaplan_meier(part["observed_days"], part["ended"])
        curves[name] = {"label": TYPE_NAMES.get(name, name), "cases": len(part),
                        "median_days": median_days(km),
                        "still_open": dict(zip(months, still_open_at(km, np.array(months) * 30.44)
                                               .round(4).tolist(), strict=True))}
    out["still_open_curves"] = curves

    # --- within a year by district, type and court level (2015-2017, eligible cases) -------
    eligible = lab[lab["within_1y"].notna() & lab["filing_year"].between(2015, 2017)]
    out["within_1y_by_year"] = eligible.groupby("filing_year")["within_1y"].mean().round(4
                                                                                     ).to_dict()
    out["within_1y_by_district"] = eligible.groupby("district")["within_1y"].agg(
        ["mean", "size"]).round(4).sort_values("mean").reset_index().to_dict("records")
    out["within_1y_by_type"] = eligible[eligible["type"].isin(MAIN_TYPES)].groupby("type")[
        "within_1y"].agg(["mean", "size"]).round(4).reset_index().to_dict("records")
    out["within_1y_by_court_level"] = eligible.groupby("court_level")["within_1y"].agg(
        ["mean", "size"]).round(4).sort_values("mean").reset_index().to_dict("records")

    # --- k-means: groups of districts -------------------------------------------------------
    profile_types = ["stc", "os", "cc", "mcop", "ep", "hmop"]
    profile = (eligible[eligible["type"].isin(profile_types)]
               .pivot_table(index="district", columns="type", values="within_1y",
                            aggfunc="mean"))
    profile.columns = [f"within_1y_{c}" for c in profile.columns]
    pending_2015 = lab[lab["filing_year"] == 2015].groupby("district")["ended"].apply(
        lambda s: float(1 - s.mean()))
    profile["open_at_cutoff_2015_filings"] = pending_2015
    result = choose_and_fit(profile)
    out["district_clusters"] = {
        "k": result.k, "silhouette": result.silhouette, "inertia": result.inertia,
        "imputed": result.imputed,
        "district_cluster": result.labels.to_dict(),
        "centres": result.centres.round(4).to_dict("index"),
        "features": list(profile.columns),
    }
    return out


def digest(analysis: dict) -> str:
    tn, nat = analysis["tamil_nadu"], analysis["national"]
    c = tn["cleaning"]
    lines = ["# Analysis digest", "", "Generated by `scripts/analyse.py`; do not edit by hand.",
             "", "## All India", "",
             f"- {nat['cases']:,} cases filed 2010-2018.",
             "- Share of 2010 filings still open at each state's scrape cutoff:", ""]
    lines += [f"  - {s['state']}: {s['pending_2010_filings']:.1%} (cutoff {s['cutoff']})"
              if s["pending_2010_filings"] is not None else
              f"  - {s['state']}: no reliable scrape date or too few 2010 cases"
              for s in nat["states"]]
    lines += ["", "## Tamil Nadu", "", f"- {tn['cases']:,} cases.",
              (f"- Law names: {c['raw_law_names']:,} raw -> {c['canonical_laws']} laws "
               f"({c['law_rows_named']:.1%} of rows named). Court names: "
               f"{c['raw_court_names']} -> {c['court_levels']} levels (incl. 'unclear')."),
              f"- Decided before filing: {c['decided_before_filing']:,}.", "",
              "### Still open after N months (filings 2015-2018, Kaplan-Meier)", "",
              "| case type | cases | median days | 12 m | 24 m | 36 m | 48 m |",
              "|---|---|---|---|---|---|---|"]
    for cv in tn["still_open_curves"].values():
        so = cv["still_open"]
        med = "not reached" if cv["median_days"] is None else f"{cv['median_days']:.0f}"
        lines.append(f"| {cv['label']} | {cv['cases']:,} | {med} | {so[12]:.0%} | {so[24]:.0%}"
                     f" | {so[36]:.0%} | {so[48]:.0%} |")
    k = tn["district_clusters"]
    best = max(k["silhouette"].values())
    lines += ["", f"### District groups (k-means, k={k['k']} by silhouette)", "",
              (f"Best silhouette {best:.2f}: a weak structure. Districts differ by degree more "
               "than they fall into clear types; treat the groups as a summary, not a finding."),
              f"Filled with the median: {k['imputed']}.", "",
              "| group | districts |", "|---|---|"]
    groups: dict[int, list[str]] = {}
    for district, g in k["district_cluster"].items():
        groups.setdefault(g, []).append(district)
    lines += [f"| {g} | {', '.join(sorted(d))} |" for g, d in sorted(groups.items())]
    return "\n".join(lines) + "\n"


def main() -> int:
    analysis = {"national": national(), "tamil_nadu": tamil_nadu()}
    REPORT.mkdir(exist_ok=True)
    (REPORT / "analysis.json").write_text(json.dumps(analysis, indent=2, default=str))
    (REPORT / "analysis.md").write_text(digest(analysis))
    print(digest(analysis))
    return 0


if __name__ == "__main__":
    sys.exit(main())
