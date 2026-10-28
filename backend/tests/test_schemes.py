import numpy as np
import pandas as pd
import pytest

from auditor.generator.base import make_honest_transactions, make_suspects
from auditor.generator.red_herrings import add_herring
from auditor.generator.schemes import SCHEME_CATCHERS, SCHEME_EXPLANATIONS, inject

SCHEMES = ["big_invoice", "duplicates", "fabricated", "weekend", "inflated_ratio", "under_limit"]


def _setup(seed=11):
    rng = np.random.default_rng(seed)
    suspects = make_suspects(rng, include_ceo=False)
    df = make_honest_transactions(rng, suspects)
    return rng, suspects, df


def _run(scheme, seed=11, fraudster="E2"):
    rng, _suspects, df = _setup(seed)
    before = df.copy()
    out, ids = inject(scheme, df, fraudster, rng)
    return before, df, out, ids


def test_catchers_and_explanations_cover_all_schemes():
    assert set(SCHEME_CATCHERS) == set(SCHEMES)
    assert set(SCHEME_EXPLANATIONS) == set(SCHEMES)
    assert SCHEME_CATCHERS["fabricated"] == ["benford"]


@pytest.mark.parametrize("scheme", SCHEMES)
def test_inject_only_touches_fraudster(scheme):
    before, _, out, ids = _run(scheme)
    fraud = out[out["txn_id"].isin(ids)]
    assert len(fraud) > 0
    assert (fraud["employee_id"] == "E2").all()
    others_before = before[before["employee_id"] != "E2"].reset_index(drop=True)
    others_after = (
        out[(out["employee_id"] != "E2")].reset_index(drop=True)
    )
    pd.testing.assert_frame_equal(others_before, others_after)


@pytest.mark.parametrize("scheme", SCHEMES)
def test_inject_does_not_mutate_input(scheme):
    before, df, _, _ = _run(scheme)
    pd.testing.assert_frame_equal(before, df)


def test_big_invoice_magnitude():
    before, _, out, ids = _run("big_invoice")
    assert 1 <= len(ids) <= 2
    honest = before[before["employee_id"] == "E2"]
    for _, row in out[out["txn_id"].isin(ids)].iterrows():
        cat_median = honest.loc[honest["category"] == row["category"], "amount"].median()
        assert row["amount"] >= 8 * cat_median


def test_duplicates_twins():
    before, _, out, ids = _run("duplicates")
    fraud = out[out["txn_id"].isin(ids)]
    assert len(fraud) >= 6
    originals = before[before["employee_id"] == "E2"]
    for _, row in fraud.iterrows():
        match = originals[
            (originals["vendor"] == row["vendor"]) & (originals["amount"] == row["amount"])
        ]
        assert len(match) >= 1
        gaps = (pd.to_datetime(row["date"]) - pd.to_datetime(match["date"])).dt.days
        assert gaps.between(1, 3).any()
        assert row["invoice_id"] not in set(originals["invoice_id"])


def test_fabricated_digits_flat():
    before, _, out, ids = _run("fabricated")
    fraud = out[out["txn_id"].isin(ids)]
    mine = before[before["employee_id"] == "E2"]
    assert len(fraud) == len(mine) >= 100
    first = (fraud["amount"] / 10 ** np.floor(np.log10(fraud["amount"]))).astype(int)
    share = first.value_counts(normalize=True).reindex(range(1, 10), fill_value=0)
    assert share.between(0.04, 0.2).all()  # flat-ish, unlike Benford's 30% ones
    # sizes stay believable: every invented amount is within half a decade of the real one
    merged = fraud.merge(mine, on="txn_id", suffixes=("", "_orig"))
    assert (np.abs(np.log10(merged["amount"] / merged["amount_orig"])) <= 0.5).all()
    margin_new = merged["amount"] / merged["revenue"]
    margin_old = merged["amount_orig"] / merged["revenue_orig"]
    assert np.allclose(margin_new, margin_old, rtol=0.02)


def test_weekend_rows():
    _, _, out, ids = _run("weekend")
    fraud = out[out["txn_id"].isin(ids)]
    assert len(fraud) >= 12
    assert (pd.to_datetime(fraud["date"]).dt.day_of_week >= 5).all()


def test_inflated_ratio():
    before, _, out, ids = _run("inflated_ratio")
    fraud = out[out["txn_id"].isin(ids)]
    assert len(fraud) >= 25
    honest_ratio = (before["amount"] / before["revenue"]).median()
    assert (fraud["amount"] / fraud["revenue"]).median() >= 1.6 * honest_ratio


def test_under_limit():
    _, _, out, ids = _run("under_limit")
    fraud = out[out["txn_id"].isin(ids)]
    assert 10 <= len(fraud) <= 14
    assert fraud["amount"].between(45_000, 49_999).all()
    assert fraud["hour"].between(1, 4).all()
    vendor = fraud["vendor"].iloc[0]
    assert (fraud["vendor"] == vendor).all()
    assert set(out.loc[out["vendor"] == vendor, "txn_id"]) == set(ids)


def test_new_txn_ids_are_unique():
    for scheme in SCHEMES:
        _, _, out, _ = _run(scheme)
        assert out["txn_id"].is_unique
        assert out["invoice_id"].is_unique


def test_diwali_herring():
    rng, suspects, df = _setup()
    out = add_herring("diwali", df, suspects, rng)
    bonus = out[out["category"] == "festival_bonus"]
    assert sorted(bonus["employee_id"]) == sorted(s.id for s in suspects)
    dates = pd.to_datetime(bonus["date"])
    assert (dates.max() - dates.min()).days <= 6
    assert bonus["amount"].between(15_000, 40_000).all()


def test_ceo_herring_is_noop():
    rng, suspects, df = _setup()
    pd.testing.assert_frame_equal(add_herring("ceo", df, suspects, rng), df)
