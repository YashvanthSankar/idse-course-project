"""The six ways to cook the books.

Each injector takes an honest ledger and returns a *new* DataFrame plus the txn ids
of the fraudulent rows. Only the fraudster's rows are ever touched or added.
"""

from datetime import timedelta

import numpy as np
import pandas as pd

from auditor.generator.base import honest_amounts, next_ids
from auditor.models import SchemeId, ToolId

SCHEME_CATCHERS: dict[SchemeId, list[ToolId]] = {
    "big_invoice": ["zscore", "iqr_box"],
    "duplicates": ["duplicates"],
    "fabricated": ["benford"],
    "weekend": ["timeseries", "groupby"],
    "inflated_ratio": ["regression"],
    "under_limit": ["isoforest", "groupby"],
}

SCHEME_EXPLANATIONS: dict[SchemeId, str] = {
    "big_invoice": (
        "One fat invoice, buried among hundreds of honest ones. Next to everyone else's "
        "claims it looked ordinary — next to their own claims in the same category it "
        "stood out like a neon sign. Compare like with like, and the outlier confesses."
    ),
    "duplicates": (
        "Same vendor, same amount, a day or two later, a fresh invoice number. They "
        "billed the company twice for the same dinner and hoped nobody would line the "
        "receipts up side by side."
    ),
    "fabricated": (
        "Every receipt was invented. Real money follows Benford's law — about 30% of "
        "amounts start with a 1. Humans making numbers up spread the first digits evenly, "
        "and that flat pattern is a fingerprint no forger thinks to hide."
    ),
    "weekend": (
        "The office is shut on Saturdays and Sundays, yet the company card kept "
        "swiping. Personal shopping, billed as business. The timeline gave it away."
    ),
    "inflated_ratio": (
        "Expenses should scale with the deals they serve. Theirs were padded by about "
        "80% on top of what the revenue justified. A regression line drew the honest "
        "margin; their claims floated far above it."
    ),
    "under_limit": (
        "Payments of ₹45,000–49,999 — always just under the ₹50,000 approval limit — at "
        "1 to 4 AM, to a vendor nobody else has ever used. Each feature alone is odd; "
        "together they are a ghost vendor. The Isolation Forest isolated it in a few cuts."
    ),
}

APPROVAL_LIMIT = 50_000
GHOST_VENDORS = [
    "Shree Siddhi Consultancy Services",
    "Apex Global Facility Solutions",
    "Nirmal Infra Advisory LLP",
]


def inject(
    scheme: SchemeId, df: pd.DataFrame, fraudster_id: str, rng: np.random.Generator
) -> tuple[pd.DataFrame, list[str]]:
    injector = {
        "big_invoice": _big_invoice,
        "duplicates": _duplicates,
        "fabricated": _fabricated,
        "weekend": _weekend,
        "inflated_ratio": _inflated_ratio,
        "under_limit": _under_limit,
    }[scheme]
    return injector(df.copy(), fraudster_id, rng)


def _mine(df: pd.DataFrame, fraudster_id: str) -> pd.DataFrame:
    return df[df["employee_id"] == fraudster_id]


def _append(df: pd.DataFrame, rows: list[dict], rng: np.random.Generator):
    txn, invoices = next_ids(df, rng, len(rows))
    for row, t, inv in zip(rows, txn, invoices):
        row["txn_id"], row["invoice_id"] = t, inv
    return pd.concat([df, pd.DataFrame(rows)[df.columns]], ignore_index=True), txn


def _big_invoice(df, fraudster_id, rng):
    mine = _mine(df, fraudster_id)
    big_cats = mine[mine["category"].isin(["equipment", "hotel", "flight", "client_meal"])]
    picks = rng.choice(big_cats.index, size=int(rng.integers(1, 3)), replace=False)
    for idx in picks:
        cat = df.at[idx, "category"]
        median = mine.loc[mine["category"] == cat, "amount"].median()
        df.at[idx, "amount"] = round(float(median * rng.uniform(9, 12)), 2)
    return df, df.loc[picks, "txn_id"].tolist()


def _duplicates(df, fraudster_id, rng):
    mine = _mine(df, fraudster_id)
    last_day = pd.to_datetime(df["date"]).max().date()
    rows: list[dict] = []
    for idx in rng.permutation(mine.index):
        orig = df.loc[idx]
        options = [g for g in (1, 2, 3)
                   if (orig["date"] + timedelta(days=g)).weekday() < 5
                   and orig["date"] + timedelta(days=g) <= last_day]
        if not options:
            continue
        row = orig.to_dict()
        row["date"] = orig["date"] + timedelta(days=int(rng.choice(options)))
        row["hour"] = int(np.clip(rng.normal(14, 2.5), 9, 20))
        rows.append(row)
        if len(rows) == 8:
            break
    return _append(df, rows, rng)


def _fabricated(df, fraudster_id, rng):
    mine = _mine(df, fraudster_id)
    orig = mine["amount"].to_numpy()
    mantissa = rng.uniform(1, 10, len(orig))
    decade = np.round(np.log10(orig) - np.log10(mantissa))
    new = np.round(mantissa * 10**decade, 2)
    margin = orig / mine["revenue"].to_numpy()
    df.loc[mine.index, "amount"] = new
    df.loc[mine.index, "revenue"] = np.round(new / margin, 2)
    return df, mine["txn_id"].tolist()


def _weekend(df, fraudster_id, rng):
    mine = _mine(df, fraudster_id)
    days = pd.to_datetime(df["date"])
    start, end = days.min().date(), days.max().date()
    weekends = [start + timedelta(days=d) for d in range((end - start).days + 1)
                if (start + timedelta(days=d)).weekday() >= 5]
    n = int(rng.integers(13, 18))
    cats = rng.choice(["client_meal", "equipment", "hotel", "chai_snacks"], size=n)
    amounts = np.round(honest_amounts(rng, cats), 2)
    vendors = mine["vendor"].value_counts().index[:6]
    rows = [{
        "date": weekends[int(rng.integers(len(weekends)))],
        "hour": int(rng.integers(11, 21)),
        "employee_id": fraudster_id,
        "vendor": str(rng.choice(vendors)),
        "category": str(c),
        "amount": float(a),
        "revenue": round(float(a / np.exp(rng.normal(np.log(0.05), 0.3))), 2),
    } for c, a in zip(cats, amounts)]
    return _append(df, rows, rng)


def _inflated_ratio(df, fraudster_id, rng):
    mine = _mine(df, fraudster_id)
    pool = mine[mine["category"].isin(["client_meal", "hotel", "flight", "cab"])]
    picks = pool.index  # every travel and dining claim gets padded
    df.loc[picks, "amount"] = np.round(df.loc[picks, "amount"] * rng.uniform(1.6, 2.0, len(picks)), 2)
    return df, df.loc[picks, "txn_id"].tolist()


def _under_limit(df, fraudster_id, rng):
    days = sorted({d for d in df["date"] if d.weekday() < 5})
    vendor = str(rng.choice(GHOST_VENDORS))
    n = int(rng.integers(10, 15))
    amounts = np.round(rng.uniform(45_000, APPROVAL_LIMIT - 1, n), 2)
    rows = [{
        "date": days[int(rng.integers(len(days)))],
        "hour": int(rng.integers(1, 5)),
        "employee_id": fraudster_id,
        "vendor": vendor,
        "category": "equipment",
        "amount": float(a),
        "revenue": round(float(a / np.exp(rng.normal(np.log(0.05), 0.3))), 2),
    } for a in amounts]
    return _append(df, rows, rng)
