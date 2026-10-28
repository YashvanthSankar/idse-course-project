"""All detective tools in one place: lookup, parameter checks and execution."""

import inspect

import pandas as pd

from auditor.charts import fig_to_json
from auditor.models import ToolId, ToolSpec
from auditor.tools import duplicates, groupby, iqr_box, summary, zscore
from auditor.tools.base import Analysis, Tool

TOOLS: dict[ToolId, Tool] = {m.TOOL.id: m.TOOL for m in (summary, groupby, zscore, iqr_box, duplicates)}


def resolve_params(tool_id: ToolId, params: dict) -> dict:
    """Validate params against the tool's spec and fill in defaults."""
    spec = TOOLS[tool_id].params
    unknown = set(params) - set(spec)
    if unknown:
        raise ValueError(f"Unknown parameter(s) for {tool_id}: {sorted(unknown)}")
    resolved: dict = {}
    for name, allowed in spec.items():
        value = params.get(name)
        if isinstance(allowed, list):
            if value is None:
                value = allowed[0]
            if value not in allowed:
                raise ValueError(f"{name} must be one of {allowed}")
        else:
            try:
                value = float(allowed if value is None else value)
            except (TypeError, ValueError):
                raise ValueError(f"{name} must be a number") from None
        resolved[name] = value
    return resolved


def run_tool(
    tool_id: ToolId, df: pd.DataFrame, params: dict, names: dict[str, str] | None = None
) -> tuple[Analysis, dict, str]:
    if tool_id not in TOOLS:
        raise ValueError(f"Unknown tool {tool_id}")
    tool = TOOLS[tool_id]
    analysis = tool.analyze(df, **resolve_params(tool_id, params))
    figure = fig_to_json(tool.chart(analysis, names))
    return analysis, figure, inspect.getsource(tool.analyze)


def tool_specs(level: int) -> list[ToolSpec]:
    return [
        ToolSpec(id=t.id, name=t.name, cost=t.cost, unlock_level=t.unlock_level, params=t.params,
                 visual=t.visual, unlocked=t.unlock_level <= level)
        for t in TOOLS.values()
    ]
