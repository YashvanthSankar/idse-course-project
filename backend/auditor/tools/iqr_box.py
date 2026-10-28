import numpy as np
import pandas as pd
import plotly.graph_objects as go

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame) -> Analysis:
    # How many times bigger is each claim than that person's usual claim in the category?
    log_amount = np.log10(df["amount"])
    group = log_amount.groupby([df["employee_id"], df["category"]])
    q1, q3 = group.transform(lambda s: s.quantile(0.25)), group.transform(lambda s: s.quantile(0.75))
    iqr = q3 - q1
    size = group.transform("size")

    # Tukey's far-out fence: beyond Q3 + 3 x IQR (only for groups with enough claims)
    outside = (log_amount > q3 + 3 * iqr) & (size >= 4)
    ratio = 10 ** (log_amount - group.transform("median"))
    flagged = df.loc[outside].assign(times_usual=ratio[outside].round(1))
    implicates = sorted(flagged["employee_id"].unique())
    return Analysis(
        title="Box & Whisker",
        summary=(
            f"{len(flagged)} claim(s) beyond the far-out fence (Q3 + 3·IQR) of the person's own "
            f"category. Flagged: {', '.join(implicates) or 'nobody'}."
        ),
        stats={"flagged_rows": len(flagged),
               **{f"max_times_usual_{e}": float(ratio[df["employee_id"] == e].max())
                  for e in sorted(df["employee_id"].unique())}},
        implicates=implicates,
        table=flagged[["txn_id", "employee_id", "category", "vendor", "amount", "times_usual"]],
        plot_data={"employee": df["employee_id"].tolist(), "ratio": ratio.round(3).tolist(),
                   "outside": outside.tolist(), "txn": df["txn_id"].tolist()},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    p = a.plot_data
    frame = pd.DataFrame(p)
    fig = go.Figure()
    for e, rows in frame.groupby("employee"):
        label = name_of(names, e)
        fig.add_trace(go.Box(
            y=rows["ratio"], name=label, boxpoints=False, marker_color=COLORS["amber"],
            line={"width": 1.5}, fillcolor="rgba(245,165,36,0.12)", showlegend=False,
        ))
        out = rows[rows["outside"]]
        if len(out):
            fig.add_trace(go.Scatter(
                x=[label] * len(out), y=out["ratio"], mode="markers", showlegend=False,
                marker={"color": COLORS["red"], "size": 13, "symbol": "x"},
                text=out["txn"], hovertemplate="%{text}: %{y:.1f}× their usual<extra></extra>",
            ))
    fig.update_layout(title="Claims vs each person's usual (same category)",
                      yaxis={"type": "log", "title": "× usual claim"})
    return fig


TOOL = Tool(id="iqr_box", name="Box & Whisker", cost=2, unlock_level=1, params={},
            visual=True, analyze=analyze, chart=chart)
