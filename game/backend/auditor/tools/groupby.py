import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import chi2_contingency

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def analyze(df: pd.DataFrame, by: str = "weekday") -> Analysis:
    data = df.assign(
        weekday=pd.Categorical(pd.to_datetime(df["date"]).dt.day_name().str[:3], WEEKDAYS),
        hour_bucket=pd.cut(df["hour"], bins=[-1, 5, 11, 16, 23],
                           labels=["night (0-5)", "morning", "afternoon", "evening"]),
    )
    # rows = employees, columns = the pattern we group by, cells = number of claims
    matrix = pd.crosstab(data["employee_id"], data[by])

    if by == "vendor":
        # Habits differ, so compare exclusivity: vendors that only ONE employee ever pays
        users_per_vendor = (matrix > 0).sum()
        exclusive = matrix.loc[:, users_per_vendor == 1].sum(axis=1)
        implicates = sorted(exclusive[exclusive >= 5].index)
        stats = {f"exclusive_{e}": int(n) for e, n in exclusive.items()}
        verdict = "claims at vendors nobody else uses"
    else:
        # Chi-square: is this employee's pattern different from everyone else's?
        stats = {}
        for employee in matrix.index:
            table = np.vstack([matrix.loc[employee], matrix.drop(employee).sum()])
            table = table[:, table.sum(axis=0) > 0]
            stats[f"p_{employee}"] = float(chi2_contingency(table).pvalue)
        implicates = sorted(e for e in matrix.index if stats[f"p_{e}"] < 0.001)
        verdict = f"a {by} pattern unlike everyone else's (chi-square p < 0.001)"

    who = ", ".join(implicates) if implicates else "nobody"
    return Analysis(
        title=f"Pattern Matrix · by {by}",
        summary=f"Stands out: {who} — {verdict}.",
        stats=stats,
        implicates=implicates,
        table=matrix.reset_index().rename(columns=str),
        plot_data={"employees": matrix.index.tolist(), "columns": [str(c) for c in matrix.columns],
                   "counts": matrix.to_numpy().tolist(), "by": by, "implicates": implicates},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    counts = np.array(a.plot_data["counts"], dtype=float)
    share = counts / counts.sum(axis=1, keepdims=True).clip(min=1)
    labels = [
        f"<span style='color:{COLORS['red']}'>{name_of(names, e)} ●</span>"
        if e in a.plot_data["implicates"] else name_of(names, e)
        for e in a.plot_data["employees"]
    ]
    fig = go.Figure(go.Heatmap(
        z=share, x=a.plot_data["columns"], y=labels, text=counts.astype(int),
        texttemplate="%{text}", colorscale=[[0, COLORS["ink_900"]], [0.5, "#7a4a12"],
                                            [1, COLORS["amber"]]],
        hovertemplate="%{y}<br>%{x}: %{text} claims (%{z:.0%} of theirs)<extra></extra>",
        showscale=False,
    ))
    fig.update_layout(title=f"Who does what · by {a.plot_data['by']}", xaxis_tickangle=-35)
    return fig


TOOL = Tool(
    id="groupby", name="Pattern Matrix", cost=1, unlock_level=1,
    params={"by": ["weekday", "vendor", "category", "hour_bucket"]}, visual=True,
    analyze=analyze, chart=chart,
)
