"""Turning a tool run into the JSON the player sees (shared by Quick Case and Career Mode)."""

import json
import math
from uuid import uuid4

import pandas as pd

from auditor.models import ToolId, ToolResult
from auditor.tools.registry import run_tool

MAX_TABLE_ROWS = 200


def records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> JSON-safe records (dates as ISO strings, NaN as null)."""
    return json.loads(df.to_json(orient="records", date_format="iso", date_unit="s"))


def clean_stats(stats: dict) -> dict[str, float | str]:
    out: dict[str, float | str] = {}
    for key, value in stats.items():
        if isinstance(value, str):
            out[key] = value
        else:
            number = float(value)
            out[key] = number if math.isfinite(number) else str(number)
    return out


def tool_result(tool_id: ToolId, df: pd.DataFrame, params: dict, names: dict[str, str],
                cost: int, budget_left: int) -> ToolResult:
    analysis, figure, code = run_tool(tool_id, df, params, names)
    return ToolResult(
        result_id=uuid4().hex[:10], tool_id=tool_id, params=params,
        title=analysis.title, summary=analysis.summary, figure=figure,
        table=None if analysis.table is None else records(analysis.table.head(MAX_TABLE_ROWS)),
        code=code, stats=clean_stats(analysis.stats), implicates=analysis.implicates,
        cost_charged=cost, budget_left=budget_left,
    )
