import pandas as pd
import pytest

from auditor.generator.cases import LEVELS, build_case, build_honest_case, unlocked_until


def test_build_case_deterministic():
    a = build_case(3, 42)
    b = build_case(3, 42)
    pd.testing.assert_frame_equal(a.df, b.df)
    assert a.truth == b.truth
    assert [s.id for s in a.meta.suspects] == [s.id for s in b.meta.suspects]


def test_different_seeds_differ():
    assert not build_case(3, 1).df.equals(build_case(3, 2).df)


def test_level_table_matches_spec():
    assert [LEVELS[i].budget for i in range(1, 8)] == [8, 8, 10, 10, 12, 14, 14]
    assert [LEVELS[i].scheme for i in range(1, 7)] == [
        "big_invoice", "duplicates", "fabricated", "weekend", "inflated_ratio", "under_limit",
    ]
    assert LEVELS[7].scheme is None
    assert LEVELS[1].herrings == ("ceo",)
    assert LEVELS[4].herrings == ("diwali",)
    assert LEVELS[6].herrings == ("ceo", "diwali")


@pytest.mark.parametrize("seed", range(20))
def test_ceo_suspect_when_herring(seed):
    case = build_case(1, seed)
    ceos = [s for s in case.meta.suspects if s.role == "CEO"]
    assert len(ceos) == 1
    assert case.truth.fraudster_id != ceos[0].id


@pytest.mark.parametrize("level", range(1, 8))
def test_truth_ids_exist_in_df(level):
    case = build_case(level, 5)
    assert set(case.truth.fraud_txn_ids) <= set(case.df["txn_id"])
    fraud_rows = case.df[case.df["txn_id"].isin(case.truth.fraud_txn_ids)]
    assert (fraud_rows["employee_id"] == case.truth.fraudster_id).all()


def test_df_sorted_and_renumbered():
    df = build_case(2, 0).df
    stamps = pd.to_datetime(df["date"]) + pd.to_timedelta(df["hour"], unit="h")
    assert stamps.is_monotonic_increasing
    assert df["txn_id"].tolist() == [f"T{i:05d}" for i in range(1, len(df) + 1)]


def test_meta_unlocked_tools():
    assert build_case(3, 0).meta.unlocked_tools == [
        "summary", "groupby", "zscore", "iqr_box", "duplicates", "benford",
    ]
    assert unlocked_until(6)[-1] == "isoforest"
    assert len(unlocked_until(7)) == 9


def test_meta_budget_and_rows():
    case = build_case(1, 0)
    assert case.meta.budget == case.meta.budget_left == 8
    assert case.meta.n_rows == len(case.df)
    assert case.meta.columns == list(case.df.columns)
    assert 800 <= case.meta.n_rows <= 1500


def test_level7_uses_override():
    assert build_case(7, 1, scheme_override="weekend").truth.scheme == "weekend"


def test_level7_without_override_picks_a_scheme():
    assert build_case(7, 1).truth.scheme is not None


def test_honest_case_has_no_fraudster():
    case = build_honest_case(3)
    assert case.truth.fraudster_id is None
    assert case.truth.fraud_txn_ids == []


def test_catching_tools_from_spec():
    assert build_case(1, 0).truth.catching_tools == ["zscore", "iqr_box"]
    assert build_case(6, 0).truth.catching_tools == ["isoforest", "groupby"]
