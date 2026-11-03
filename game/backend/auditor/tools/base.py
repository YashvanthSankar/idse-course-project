"""What every detective tool returns, and how the registry describes it."""

from collections.abc import Callable
from dataclasses import dataclass, field

import pandas as pd
import plotly.graph_objects as go

from auditor.models import ToolId


@dataclass(frozen=True)
class Analysis:
    title: str
    summary: str
    stats: dict[str, float | str]
    implicates: list[str]
    table: pd.DataFrame | None = None
    plot_data: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Tool:
    id: ToolId
    name: str
    cost: int
    unlock_level: int
    params: dict[str, list[str] | float]
    visual: bool
    analyze: Callable[..., Analysis]
    chart: Callable[[Analysis, dict[str, str] | None], go.Figure]
