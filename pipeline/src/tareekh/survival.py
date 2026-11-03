"""The share of cases still open after t days (Kaplan–Meier), using every case.

"Median days among decided cases" is badly biased here: the slow cases are exactly the ones
still pending at the scrape, so it falls from 1,343 days for 2010 filings to 18 days for 2017's.
Kaplan–Meier uses each case for as long as it was watched: a pending case counts as "still
open" until the cutoff, a transferred one until its transfer, and then drops out of the
denominator instead of being counted as finished or ignored.

    S(t) = Π over end times t_i <= t of (1 - d_i / n_i)

with d_i cases ending at t_i and n_i cases still watched just before t_i. It assumes
watching stops for reasons unrelated to how soon a case would have ended. For the scrape
cutoff that holds; for transfers it is an approximation, stated as such.
"""

import numpy as np
import pandas as pd


def kaplan_meier(durations, ended) -> pd.DataFrame:
    """One row per distinct end time: at_risk, ended, still_open (the survival curve)."""
    d = np.asarray(durations, dtype=float)
    e = np.asarray(ended, dtype=bool)
    keep = ~np.isnan(d)
    d, e = d[keep], e[keep]
    if d.size == 0:
        return pd.DataFrame(columns=["days", "at_risk", "ended", "still_open"])
    times, counts = np.unique(d[e], return_counts=True)
    order = np.sort(d)
    at_risk = d.size - np.searchsorted(order, times, side="left")
    still_open = np.cumprod(1.0 - counts / at_risk)
    return pd.DataFrame({"days": times, "at_risk": at_risk, "ended": counts,
                         "still_open": still_open})


def still_open_at(curve: pd.DataFrame, days) -> np.ndarray:
    """The step function evaluated at the given days (1.0 before the first ending)."""
    days = np.asarray(days, dtype=float)
    idx = np.searchsorted(curve["days"].to_numpy(), days, side="right") - 1
    values = curve["still_open"].to_numpy()
    return np.where(idx >= 0, values[np.clip(idx, 0, None)], 1.0)


def median_days(curve: pd.DataFrame) -> float | None:
    """First time at which half the cases have ended; None if that's never observed."""
    hit = curve.loc[curve["still_open"] <= 0.5, "days"]
    return float(hit.iloc[0]) if len(hit) else None
