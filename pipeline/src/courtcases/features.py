"""The model's inputs: only what is known on the day a case is filed.

Kept out on purpose:
- purpose_name, date_first_list / date_last_list / date_next_list: they describe where the
  case stands *later* (the latest hearing's purpose, the next date), so they leak the answer;
- disp_name, date_of_decision: the outcome itself;
- petitioner / defendant gender: known at filing, but the project shows gender as EDA with
  caveats and does not let a public tool score cases by it;
- court_no: a visitor to the site can't know which numbered court will hear their case, so
  congestion is measured for the district's courts of that level, not the single court.

`judge_position` (→ court level) is the court the case sat in when scraped; for cases that never
moved (moved cases are censored at the move) that is the court it was filed in.
"""

import numpy as np
import pandas as pd

from courtcases.acts import canonical_act
from courtcases.courts import court_level
from courtcases.sections import primary_section

BASE_CATEGORICAL = ["district", "court_level", "case_type", "filing_month"]
BASE_NUMERIC = ["log_prev_year_filings", "log_pending_at_filing", "clearance_last_year"]
# From the per-case acts/sections file (what the case was filed under)
LAW_CATEGORICAL = ["law", "law_section", "ipc_bailable", "criminal"]
LAW_NUMERIC = ["n_ipc_sections"]

FEATURE_SETS = {
    "filing basics": (BASE_CATEGORICAL, BASE_NUMERIC),
    "+ law and section": (BASE_CATEGORICAL + LAW_CATEGORICAL, BASE_NUMERIC + LAW_NUMERIC),
}
CATEGORICAL, NUMERIC = FEATURE_SETS["filing basics"]
FEATURES = CATEGORICAL + NUMERIC
OTHER_TYPE = "other"
NO_LAW = "not recorded"


def type_vocabulary(case_types: pd.Series, min_count: int = 200) -> list[str]:
    """Case types common enough to learn from (decided on training data only)."""
    counts = case_types.value_counts()
    return sorted(counts[counts >= min_count].index)


def prev_year_load(all_cases: pd.DataFrame) -> pd.Series:
    """Filings of the same type in the same district in the previous calendar year, per case:
    a congestion signal that exists on the filing day."""
    counts = (all_cases.groupby(["dist_code", "type", "filing_year"]).size()
              .rename("n").reset_index())
    counts["filing_year"] += 1  # last year's count is this year's input
    merged = all_cases[["dist_code", "type", "filing_year"]].merge(
        counts, how="left", on=["dist_code", "type", "filing_year"])
    return pd.Series(merged["n"].fillna(0).to_numpy(), index=all_cases.index)


def congestion(cases: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    """How busy the court was on each case's filing day, from earlier cases only:
    - pending_at_filing: cases in the same group filed before that day and not yet ended or
      moved away (a queue length);
    - disposed_last_year: cases in the group that ended or moved in the 365 days before;
    - clearance_last_year: disposed_last_year / (pending_at_filing + 1), how fast the queue
      moves relative to its length.
    Needs `observed_days`/`ended` from courtcases.target; cases with an end date after the cutoff
    count as still pending. Early-year incompleteness (quick cases missing before
    digitisation) hardly affects these from 2015 on: the missing cases had long since ended."""
    filed = cases["date_of_filing"].to_numpy("datetime64[D]")
    left = cases["date_of_filing"] + pd.to_timedelta(cases["observed_days"], unit="D")
    gone = cases["ended"] | (cases.get("group", pd.Series("", index=cases.index)) == "moved")
    end = np.where(gone & left.notna(), left.to_numpy("datetime64[D]"),
                   np.datetime64("2100-01-01"))
    pending = np.zeros(len(cases))
    disposed = np.zeros(len(cases))
    for idx in cases.groupby(group_cols, sort=False).indices.values():
        f, e = np.sort(filed[idx]), np.sort(end[idx])
        t = filed[idx]
        pending[idx] = np.searchsorted(f, t, "left") - np.searchsorted(e, t, "left")
        disposed[idx] = (np.searchsorted(e, t, "left")
                         - np.searchsorted(e, t - np.timedelta64(365, "D"), "left"))
    return pd.DataFrame({"pending_at_filing": pending, "disposed_last_year": disposed,
                         "clearance_last_year": disposed / (pending + 1)}, index=cases.index)


def decode_acts(acts: pd.DataFrame, act_key: pd.DataFrame, section_key: pd.DataFrame
                ) -> pd.DataFrame:
    """acts_sections rows (codes) -> law, main section and DDL's IPC columns, per case id."""
    act_name = act_key.set_index("act")["act_s"]
    section_name = section_key.set_index("section")["section_s"]
    out = pd.DataFrame({"ddl_case_id": acts["ddl_case_id"]})
    out["law"] = acts["act"].map(act_name).fillna("").map(canonical_act)
    out["section"] = acts["section"].map(section_name).fillna("").map(primary_section)
    out["ipc_bailable"] = acts["bailable_ipc"].replace("", "not an IPC case")
    out["n_ipc_sections"] = pd.to_numeric(acts["number_sections_ipc"], errors="coerce"
                                          ).fillna(0).clip(upper=10)
    out["criminal"] = acts["criminal"].map({"1": "criminal", "0": "civil"}).fillna("unknown")
    return out


def section_vocabulary(law: pd.Series, section: pd.Series, top: int = 40) -> list[str]:
    """The most common "law s.section" pairs (decided on training data only)."""
    pairs = (law + " s." + section)[section != ""]
    return list(pairs.value_counts().head(top).index)


def add_law(frame: pd.DataFrame, labelled: pd.DataFrame, acts: pd.DataFrame,
            vocabulary: list[str]) -> pd.DataFrame:
    """Join the decoded acts to the feature frame; cases without a row get "not recorded"."""
    joined = labelled[["ddl_case_id"]].merge(acts, how="left", on="ddl_case_id")
    joined.index = labelled.index
    out = frame.copy()
    out["law"] = joined["law"].fillna(NO_LAW)
    pair = joined["law"].fillna("") + " s." + joined["section"].fillna("")
    out["law_section"] = pair.where(pair.isin(vocabulary), out["law"] + " (other section)")
    out["ipc_bailable"] = joined["ipc_bailable"].fillna(NO_LAW)
    out["criminal"] = joined["criminal"].fillna(NO_LAW)
    out["n_ipc_sections"] = joined["n_ipc_sections"].fillna(0)
    return out


def build(labelled: pd.DataFrame, district_names: dict[str, str], vocabulary: list[str]
          ) -> pd.DataFrame:
    """One row per case: the basic features plus filing_year (for splitting) and the label."""
    frame = pd.DataFrame(index=labelled.index)
    frame["district"] = labelled["dist_code"].map(district_names).fillna(labelled["dist_code"])
    frame["court_level"] = labelled["judge_position"].map(court_level)
    frame["case_type"] = labelled["type"].where(labelled["type"].isin(vocabulary), OTHER_TYPE)
    frame["filing_month"] = labelled["date_of_filing"].dt.month.astype("Int64").astype(str)
    frame["log_prev_year_filings"] = np.log1p(prev_year_load(labelled))
    load = congestion(labelled.assign(court_level=frame["court_level"]),
                      ["dist_code", "court_level"])
    frame["log_pending_at_filing"] = np.log1p(load["pending_at_filing"])
    frame["clearance_last_year"] = load["clearance_last_year"]
    frame["filing_year"] = labelled["filing_year"]
    frame["within_1y"] = labelled["within_1y"]
    return frame
