"""Innocent things that look guilty — the game's lesson that an outlier is not a crime."""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from auditor.generator.base import FESTIVAL_VENDOR, MARGIN_MEDIAN, next_ids
from auditor.models import HerringId, Suspect

DIWALI_2026 = date(2026, 11, 8)


def add_herring(
    herring: HerringId, df: pd.DataFrame, suspects: list[Suspect], rng: np.random.Generator
) -> pd.DataFrame:
    if herring == "ceo":
        return df  # the CEO's 4x spending is already part of the honest baseline
    return _diwali_bonus(df.copy(), suspects, rng)


def _diwali_bonus(df: pd.DataFrame, suspects: list[Suspect], rng: np.random.Generator):
    """Everyone gets a festival bonus in the working week before Diwali."""
    days = pd.to_datetime(df["date"])
    start, end = days.min().date(), days.max().date()
    monday = DIWALI_2026 - timedelta(days=DIWALI_2026.weekday() + 7)
    if not (start <= monday and monday + timedelta(days=4) <= end):
        midpoint = start + (end - start) / 2
        monday = midpoint - timedelta(days=midpoint.weekday())
    txn, invoices = next_ids(df, rng, len(suspects))
    amounts = np.round(rng.uniform(15_000, 40_000, len(suspects)), 2)
    rows = pd.DataFrame({
        "txn_id": txn,
        "date": [monday + timedelta(days=int(rng.integers(0, 5))) for _ in suspects],
        "hour": 11,
        "employee_id": [s.id for s in suspects],
        "vendor": FESTIVAL_VENDOR,
        "category": "festival_bonus",
        "amount": amounts,
        "revenue": np.round(amounts / MARGIN_MEDIAN, 2),
        "invoice_id": invoices,
    })
    return pd.concat([df, rows[df.columns]], ignore_index=True)
