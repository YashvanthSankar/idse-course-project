import inspect

import pytest

from auditor.generator.cases import build_case, build_honest_case
from auditor.tools import groupby, summary
from auditor.tools.registry import TOOLS, resolve_params, run_tool, tool_specs

SPEC_COSTS = {"summary": 1, "groupby": 1, "zscore": 2, "iqr_box": 2, "duplicates": 2,
              "benford": 3, "timeseries": 3, "regression": 4, "isoforest": 5}


def test_registry_costs_match_spec():
    for tool_id, tool in TOOLS.items():
        assert tool.cost == SPEC_COSTS[tool_id]


def test_code_is_real_source():
    df = build_case(1, 0).df
    _, _, code = run_tool("summary", df, {})
    assert code == inspect.getsource(summary.analyze)


def test_summary_implicates_nobody():
    analysis, fig, _ = run_tool("summary", build_case(1, 0).df, {})
    assert analysis.implicates == []
    assert len(analysis.table) == 5
    assert fig["data"]


def test_groupby_weekday_catches_weekend_fraud():
    case = build_case(4, 0)
    analysis, _, _ = run_tool("groupby", case.df, {"by": "weekday"})
    assert analysis.implicates == [case.truth.fraudster_id]


def test_groupby_vendor_catches_ghost_vendor():
    case = build_case(6, 0)
    analysis, _, _ = run_tool("groupby", case.df, {"by": "vendor"})
    assert analysis.implicates == [case.truth.fraudster_id]


@pytest.mark.parametrize("by", ["weekday", "vendor", "category", "hour_bucket"])
def test_groupby_quiet_on_honest_case(by):
    analysis, _, _ = run_tool("groupby", build_honest_case(1).df, {"by": by})
    assert analysis.implicates == []


def test_groupby_rejects_bad_param():
    with pytest.raises(ValueError):
        run_tool("groupby", build_case(1, 0).df, {"by": "colour"})


def test_unknown_param_rejected():
    with pytest.raises(ValueError):
        resolve_params("summary", {"foo": 1})


def test_defaults_filled():
    assert resolve_params("groupby", {}) == {"by": "weekday"}


def test_figure_uses_noir_template():
    _, fig, _ = run_tool("groupby", build_case(1, 0).df, {"by": "category"})
    assert fig["layout"]["paper_bgcolor"] == "rgba(0,0,0,0)"


def test_tool_specs_mark_locked_tools():
    specs = {s.id: s for s in tool_specs(1)}
    assert specs["summary"].unlocked and specs["groupby"].unlocked
    assert groupby.TOOL.unlock_level == 1
