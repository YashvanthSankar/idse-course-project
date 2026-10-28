import numpy as np
import pytest

from auditor.generator.cases import build_case, build_honest_case
from auditor.tools.registry import TOOLS, run_tool

SPEC_COSTS = {"summary": 1, "groupby": 1, "zscore": 2, "iqr_box": 2, "duplicates": 2,
              "benford": 3, "timeseries": 3, "regression": 4, "isoforest": 5}


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_regression_catches_inflated(seed):
    case = build_case(5, seed)
    a, _, _ = run_tool("regression", case.df, {})
    assert a.implicates == [case.truth.fraudster_id]
    assert 0 < a.stats["r2"] < 1


def test_regression_line_in_plot_data():
    df = build_case(5, 0).df
    a, _, _ = run_tool("regression", df, {})
    slope, intercept = np.polyfit(np.log10(df["revenue"]), np.log10(df["amount"]), 1)
    assert a.plot_data["slope"] == pytest.approx(slope, abs=1e-6)
    assert a.plot_data["intercept"] == pytest.approx(intercept, abs=1e-6)


def test_regression_quiet_on_honest_case():
    a, _, _ = run_tool("regression", build_honest_case(0).df, {})
    assert a.implicates == []


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_isoforest_catches_ghost_vendor(seed):
    case = build_case(6, seed)
    a, fig, _ = run_tool("isoforest", case.df, {})
    assert a.implicates == [case.truth.fraudster_id]
    assert fig["data"]


def test_isoforest_deterministic():
    df = build_case(6, 0).df
    a, _, _ = run_tool("isoforest", df, {})
    b, _, _ = run_tool("isoforest", df, {})
    assert a.implicates == b.implicates and a.stats == b.stats


def test_isoforest_quiet_on_honest_case():
    a, _, _ = run_tool("isoforest", build_honest_case(0).df, {})
    assert a.implicates == []


def test_registry_complete():
    assert len(TOOLS) == 9
    assert {t: TOOLS[t].cost for t in TOOLS} == SPEC_COSTS
