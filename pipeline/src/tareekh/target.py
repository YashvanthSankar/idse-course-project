"""Turn each case into what the models learn from: how long it was watched, whether it ended,
and the "ended within H days?" label, without pretending to know what we can't.

For each case:
- `observed_days`: from filing to the end of the case if it ended before the cutoff,
  otherwise to the moment we stop seeing it (the court's scrape cutoff, or the day it moved
  to another court).
- `ended`: True only if the case finished in this court on or before the cutoff.

Rules (each is a decision we defend):
1. A decision dated after the court's cutoff is treated as *not yet ended at the cutoff*. The
   cutoff is the last date we can see for that court; a later date is either a re-scrape of a
   few courts or a typo, and either way it isn't comparable with the other cases.
2. A case that moved (transferred, committed, remanded, referred to a Lok Adalat) is watched
   until the move and then censored: it didn't end, it left.
3. A decision date with no recorded disposition counts as an ending (DDL marks 45,938 such
   2010 cases "disposition var missing" but the date says the case was decided).
4. Unusable: filed after the cutoff, decided before filing, an impossible decision date
   paired with an ending, or no cutoff for the court. These are counted, not guessed.
5. "Ended within H days?" is only defined for cases **filed at least H days before their
   court's cutoff**: every one of them had the full H days to end. Without that rule, recent
   filings that ended fast are labelled 1 while their slow neighbours are still unknown, and
   the label is biased towards "fast" (measured: 92.6% "within a year" for 2018 filings).
   Among eligible cases it is 1 if the case ended by day H, 0 if it was still open after H days,
   and unknown only if it moved to another court before day H.
"""

import numpy as np
import pandas as pd

from tareekh.outcomes import ENDS_CASE, outcome_group


def label(df: pd.DataFrame, cutoff: pd.Series) -> pd.DataFrame:
    """Add observed_days, ended and unusable to cases decoded by `cases.decode`.

    `cutoff` is one timestamp per row (aligned with df), e.g. the district's cutoff."""
    out = df.copy()
    cutoff = pd.to_datetime(cutoff).reindex(out.index)
    group = out["disp"].map(outcome_group) if "group" not in out else out["group"]
    out["group"] = group
    filed = out["date_of_filing"]
    decided = out["date_of_decision"]

    has_date = decided.notna() & ~out["decided_before_filing"]
    in_window = has_date & (decided <= cutoff)
    moved = group.eq("moved") & in_window
    ends = in_window & (group.isin(ENDS_CASE) | group.eq("missing"))

    reason = pd.Series("", index=out.index, dtype="object")
    reason[cutoff.isna()] = "no cutoff for this court"
    reason[(reason == "") & (filed > cutoff)] = "filed after the cutoff"
    reason[(reason == "") & out["decided_before_filing"]] = "decided before filing"
    reason[(reason == "") & out["date_of_decision_impossible"] & group.isin(ENDS_CASE)] = (
        "impossible decision date")
    reason[(reason == "") & group.eq("interim")] = "bail or interim order"
    out["unusable"] = reason

    out["cutoff"] = cutoff
    stop = cutoff.where(~(ends | moved), decided)
    out["observed_days"] = (stop - filed).dt.days.astype("float")
    out["ended"] = ends
    usable = reason == ""
    out.loc[~usable, ["observed_days"]] = np.nan
    out.loc[~usable, "ended"] = False
    return out


def within(labelled: pd.DataFrame, horizon_days: int) -> pd.Series:
    """1.0 = ended within the horizon, 0.0 = still open after it, NaN = can't know."""
    days, ended = labelled["observed_days"], labelled["ended"]
    full_follow_up = (labelled["cutoff"] - labelled["date_of_filing"]).dt.days >= horizon_days
    result = pd.Series(np.nan, index=labelled.index)
    result[ended & (days <= horizon_days)] = 1.0
    result[days > horizon_days] = 0.0
    result[(labelled["unusable"] != "") | ~full_follow_up] = np.nan
    return result
