"""Two honest follow-ups to the headline accuracy: how hard is each kind of case to predict,
and where does the time in a case actually go?

Accuracy over all cases looks high largely because petty summary trials and bail-type petitions
are nearly always over within a year. Comparing with "always guess the commonest answer"
inside each group shows what the model adds.

The hearing dates can't be model inputs (they happen after filing), but they can describe a case:
how long it waits for a first hearing, how long it runs after that, the gap between its two
most recent hearing dates, and the stage it was stuck at when the data was collected.
"""

import pandas as pd
from sklearn.metrics import roc_auc_score

from courtcases.survival import kaplan_meier, median_days

EASY_TYPES = ("stc", "crlmp")  # summary trials and criminal miscellaneous (bail-type) petitions


def score_group(y: pd.Series, p: pd.Series) -> dict:
    """Accuracy at the 50% line, against always guessing the group's commonest answer."""
    share_yes = float(y.mean())
    return {"n": len(y), "share_yes": share_yes,
            "accuracy": float(((p >= 0.5) == (y == 1)).mean()),
            "majority_accuracy": max(share_yes, 1 - share_yes),
            "auc": float(roc_auc_score(y, p)) if y.nunique() > 1 else None}


def difficulty_table(test: pd.DataFrame, min_cases: int = 2000) -> dict:
    """`test` has y (0/1), p (probability) and case_type."""
    easy = test["case_type"].isin(EASY_TYPES)
    rows = [{"case_type": t, **score_group(part["y"], part["p"])}
            for t, part in test.groupby("case_type") if len(part) >= min_cases]
    return {"all": score_group(test["y"], test["p"]),
            "easy": score_group(test.loc[easy, "y"], test.loc[easy, "p"]),
            "contested": score_group(test.loc[~easy, "y"], test.loc[~easy, "p"]),
            "by_type": sorted(rows, key=lambda r: -r["n"])}


def stage_days(cases: pd.DataFrame) -> pd.DataFrame:
    """Per usable case: days from filing to first hearing, and days from first hearing to the
    end of observation. A first hearing that is blank or before filing gives NaN."""
    filed, first = cases["date_of_filing"], cases["date_first_list"]
    wait = (first - filed).dt.days.astype("float")
    wait = wait.where(wait >= 0)
    stop = filed + pd.to_timedelta(cases["observed_days"], unit="D")
    after = (stop - first).dt.days.astype("float")
    after = after.where(wait.notna() & (after >= 0))
    return pd.DataFrame({"wait_first_hearing": wait, "after_first_hearing": after,
                         "ended": cases["ended"]}, index=cases.index)


def stage_summary(stages: pd.DataFrame) -> dict:
    """Median wait for a first hearing, and the Kaplan-Meier median time after it, which counts
    cases still running instead of dropping them (None: half never ended within the data)."""
    return {"cases": int(stages["after_first_hearing"].notna().sum()),
            "median_wait_first_hearing": float(stages["wait_first_hearing"].median()),
            "median_after_first_hearing": median_days(
                kaplan_meier(stages["after_first_hearing"], stages["ended"]))}


def hearing_gap(cases: pd.DataFrame) -> pd.Series:
    """Days between a case's last hearing and its next listed date, for cases still open."""
    open_cases = cases[~cases["ended"] & cases["group"].ne("moved")]
    gap = (open_cases["date_next_list"] - open_cases["date_last_list"]).dt.days
    return gap[gap.between(1, 730)]


def stuck_at(cases: pd.DataFrame, top: int = 10) -> list[dict]:
    """The stage recorded at the latest hearing, among cases still open at the cutoff."""
    open_cases = cases[~cases["ended"] & cases["group"].ne("moved")]
    purpose = open_cases["purpose"].fillna("").str.strip().str.lower()
    recorded = purpose[purpose != ""]
    shares = recorded.value_counts(normalize=True).head(top)
    return [{"purpose": k, "share": float(v)} for k, v in shares.items()]
