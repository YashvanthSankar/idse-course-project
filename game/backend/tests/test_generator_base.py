import numpy as np
import pandas as pd
import pytest

from auditor.generator.base import make_honest_transactions, make_suspects

COLUMNS = [
    "txn_id", "date", "hour", "employee_id", "vendor",
    "category", "amount", "revenue", "invoice_id",
]


def _df(seed=7, include_ceo=False):
    rng = np.random.default_rng(seed)
    suspects = make_suspects(rng, include_ceo=include_ceo)
    return suspects, make_honest_transactions(rng, suspects)


def test_suspects_ids_and_ceo():
    rng = np.random.default_rng(0)
    suspects = make_suspects(rng, include_ceo=True)
    assert [s.id for s in suspects] == ["E1", "E2", "E3", "E4", "E5"]
    assert sum(s.role == "CEO" for s in suspects) == 1


def test_columns_exact():
    _, df = _df()
    assert list(df.columns) == COLUMNS


def test_deterministic():
    _, a = _df(7)
    _, b = _df(7)
    pd.testing.assert_frame_equal(a, b)


def test_weekend_share_low():
    _, df = _df()
    weekend = pd.to_datetime(df["date"]).dt.day_of_week >= 5
    assert weekend.mean() <= 0.03


def test_hours_mostly_office():
    _, df = _df()
    assert df["hour"].between(9, 20).mean() >= 0.95


@pytest.mark.parametrize("seed", [0, 1, 2, 3, 4])
def test_honest_data_is_benford_like(seed):
    _, df = _df(seed)
    first = (df["amount"] / 10 ** np.floor(np.log10(df["amount"]))).astype(int)
    observed = first.value_counts(normalize=True).reindex(range(1, 10), fill_value=0)
    expected = np.log10(1 + 1 / np.arange(1, 10))
    assert np.abs(observed.to_numpy() - expected).mean() < 0.015


def test_invoice_ids_unique():
    _, df = _df()
    assert df["invoice_id"].is_unique
    assert df["txn_id"].is_unique


def test_amounts_positive():
    _, df = _df()
    assert (df["amount"] > 0).all()
    assert (df["revenue"] > 0).all()


def test_revenue_ratio():
    _, df = _df()
    assert 0.04 <= (df["amount"] / df["revenue"]).median() <= 0.06


def test_ceo_spends_more():
    suspects, df = _df(3, include_ceo=True)
    ceo = next(s.id for s in suspects if s.role == "CEO")
    med = df.groupby("employee_id")["amount"].median()
    others = med.drop(ceo).median()
    assert med[ceo] > 2.5 * others
