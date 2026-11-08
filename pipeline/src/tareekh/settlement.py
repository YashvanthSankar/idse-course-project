"""How a case ends: settled by the parties, or dismissed without a ruling.

A case can only be labelled fairly if it was watched for the whole horizon, as in target.py.
Scoring only the cases that have already ended looks better than it is, because on filing day
nobody knows which cases those will be. reports/settlement.json keeps both numbers side by side.
"""

import numpy as np
import pandas as pd

from tareekh.target import within


def ended_as(labelled: pd.DataFrame, group: str, horizon_days: int) -> pd.Series:
    """1.0 = ended this way within the horizon, 0.0 = didn't, NaN = can't know."""
    finished = within(labelled, horizon_days)
    out = ((finished == 1) & labelled["group"].eq(group)).astype(float)
    return out.where(finished.notna())


def lookup_rates(train: pd.DataFrame, test: pd.DataFrame, keys: list[str], target: str,
                 prior_weight: int = 20) -> np.ndarray:
    """A plain table of rates per combination of `keys`, shrunk towards the overall rate."""
    overall = train[target].mean()
    grouped = train.groupby(keys)[target].agg(["sum", "count"])
    rate = ((grouped["sum"] + prior_weight * overall) / (grouped["count"] + prior_weight)).rename("rate")
    joined = test[keys].merge(rate, how="left", left_on=keys, right_index=True)
    return joined["rate"].fillna(overall).to_numpy()


def top_decile_precision(y: np.ndarray, p: np.ndarray) -> float:
    """Among the 10% of cases scored highest, the share that really ended this way."""
    k = max(1, len(y) // 10)
    return float(y[np.argsort(-p, kind="stable")[:k]].mean())
