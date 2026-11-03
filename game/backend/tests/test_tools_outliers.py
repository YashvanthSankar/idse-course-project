import pytest

from auditor.generator.cases import build_case, build_honest_case
from auditor.tools.registry import run_tool


def _ceo(case):
    return next(s.id for s in case.meta.suspects if s.role == "CEO")


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_zscore_per_employee_catches_big_invoice(seed):
    case = build_case(1, seed)
    a, _, _ = run_tool("zscore", case.df, {"scope": "per_employee"})
    assert a.implicates == [case.truth.fraudster_id]


def test_zscore_global_flags_ceo():
    case = build_case(1, 0)
    a, _, _ = run_tool("zscore", case.df, {"scope": "global"})
    assert _ceo(case) in a.implicates


def test_zscore_default_is_per_employee_and_threshold():
    case = build_case(1, 0)
    a, _, _ = run_tool("zscore", case.df, {})
    assert a.stats["scope"] == "per_employee"
    assert a.stats["threshold"] == 3.0


def test_zscore_quiet_on_honest_case():
    a, _, _ = run_tool("zscore", build_honest_case(0).df, {"scope": "per_employee"})
    assert a.implicates == []


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_iqr_box_catches_big_invoice(seed):
    case = build_case(1, seed)
    a, fig, _ = run_tool("iqr_box", case.df, {})
    assert a.implicates == [case.truth.fraudster_id]
    assert fig["data"]


def test_iqr_box_quiet_on_honest_case():
    a, _, _ = run_tool("iqr_box", build_honest_case(0).df, {})
    assert a.implicates == []


def test_duplicates_catches_twins():
    case = build_case(2, 0)
    a, _, _ = run_tool("duplicates", case.df, {})
    assert a.implicates == [case.truth.fraudster_id]
    assert a.stats["twin_pairs"] >= 6


def test_duplicates_table_lists_pairs():
    a, _, _ = run_tool("duplicates", build_case(2, 0).df, {})
    assert list(a.table.columns) == ["employee_id", "vendor", "amount", "date_a", "date_b"]


def test_duplicates_quiet_on_honest_case():
    a, _, _ = run_tool("duplicates", build_honest_case(0).df, {})
    assert a.implicates == [] and a.stats["twin_pairs"] == 0
