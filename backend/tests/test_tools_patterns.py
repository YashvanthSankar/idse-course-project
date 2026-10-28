import numpy as np
import pytest

from auditor.generator.cases import build_case, build_honest_case
from auditor.tools.registry import run_tool


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_benford_catches_fabricated(seed):
    case = build_case(3, seed)
    a, _, _ = run_tool("benford", case.df, {})
    f = case.truth.fraudster_id
    assert a.implicates == [f]
    assert a.stats[f"p_{f}"] < 0.001
    assert a.stats[f"verdict_{f}"] == "suspicious"


def test_benford_small_sample_inconclusive():
    df = build_case(1, 0).df
    e1 = df[df["employee_id"] == "E1"]
    small = df.drop(e1.index[30:])
    a, _, _ = run_tool("benford", small, {})
    assert a.stats["verdict_E1"] == "inconclusive"
    assert "E1" not in a.implicates


def test_benford_expected_curve():
    a, _, _ = run_tool("benford", build_case(3, 0).df, {})
    assert np.allclose(a.plot_data["expected"], np.log10(1 + 1 / np.arange(1, 10)), atol=1e-9)


def test_benford_quiet_on_honest_case():
    a, _, _ = run_tool("benford", build_honest_case(0).df, {})
    assert a.implicates == []


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_timeseries_catches_weekend(seed):
    case = build_case(4, seed)
    a, fig, _ = run_tool("timeseries", case.df, {"freq": "D"})
    assert a.implicates == [case.truth.fraudster_id]
    assert fig["data"]


def test_timeseries_ignores_diwali():
    a, _, _ = run_tool("timeseries", build_honest_case(0).df, {"freq": "W"})
    assert a.implicates == []


def test_timeseries_rejects_bad_freq():
    with pytest.raises(ValueError):
        run_tool("timeseries", build_case(4, 0).df, {"freq": "M"})


def test_timeline_chart_has_one_row_per_employee_with_weekend_share():
    case = build_case(4, 0)
    _, fig, _ = run_tool("timeseries", case.df, {"freq": "D"},
                         names={s.id: s.name for s in case.meta.suspects})
    rows = fig["layout"]["yaxis"]["categoryarray"]
    assert len(rows) == 5
    fraudster = next(s.name for s in case.meta.suspects if s.id == case.truth.fraudster_id)
    label = next(r for r in rows if fraudster in r)
    assert "%" in label  # each row shows that person's weekend share


def test_timeline_weekly_groups_weekend_claims():
    _, fig, _ = run_tool("timeseries", build_case(4, 0).df, {"freq": "W"})
    sizes = [s for t in fig["data"] if t.get("marker", {}).get("size") is not None
             and isinstance(t["marker"]["size"], list) for s in t["marker"]["size"]]
    assert sizes and max(sizes) > min(sizes)  # bubbles scale with the number of claims
