import numpy as np
import pandas as pd
import plotly.graph_objects as go

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame, scope: str = "per_employee", threshold: float = 3.0) -> Analysis:
    if scope == "global":
        # Naive: compare every claim with the whole company's claims, in raw rupees
        values = df["amount"]
        z = (values - values.mean()) / values.std()
    else:
        # Fair: compare each claim with the same person's claims in the same category.
        # Money is log-normal, so we measure distance in log10(amount).
        values = np.log10(df["amount"])
        group = values.groupby([df["employee_id"], df["category"]])
        z = (values - group.transform("mean")) / group.transform("std")

    flagged = df.loc[z.abs() > threshold].assign(z=z.round(2))
    counts = flagged["employee_id"].value_counts()
    implicates = sorted(counts.index)
    return Analysis(
        title=f"Z-Score Scan · {scope.replace('_', ' ')}",
        summary=(
            f"{len(flagged)} claim(s) more than {threshold:g} standard deviations from "
            f"{'the company average' if scope == 'global' else 'that person’s own normal'}. "
            f"Flagged: {', '.join(implicates) or 'nobody'}."
        ),
        stats={"scope": scope, "threshold": threshold, "flagged_rows": len(flagged),
               **{f"flagged_{e}": int(n) for e, n in counts.items()}},
        implicates=implicates,
        table=flagged[["txn_id", "employee_id", "category", "vendor", "amount", "z"]],
        plot_data={"employee": df["employee_id"].tolist(), "z": z.fillna(0).round(3).tolist(),
                   "amount": df["amount"].tolist(), "txn": df["txn_id"].tolist(),
                   "threshold": threshold, "scope": scope},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    p = a.plot_data
    z = np.array(p["z"])
    employees = sorted(set(p["employee"]))
    rank = {e: i for i, e in enumerate(employees)}
    jitter = np.random.default_rng(0).uniform(-0.28, 0.28, len(z))
    y = np.array([rank[e] for e in p["employee"]]) + jitter
    hot = np.abs(z) > p["threshold"]
    fig = go.Figure()
    for mask, color, size, label in [(~hot, COLORS["muted"], 5, "normal"),
                                     (hot, COLORS["red"], 11, "suspicious")]:
        fig.add_trace(go.Scatter(
            x=z[mask], y=y[mask], mode="markers", name=label,
            marker={"color": color, "size": size, "opacity": 0.55 if label == "normal" else 1,
                    "line": {"width": 1, "color": COLORS["ink_950"]}},
            customdata=np.column_stack([np.array(p["txn"])[mask], np.array(p["amount"])[mask]]),
            hovertemplate="%{customdata[0]} · ₹%{customdata[1]:,.0f}<br>z = %{x:.2f}<extra></extra>",
        ))
    for t in (-p["threshold"], p["threshold"]):
        fig.add_vline(x=t, line={"color": COLORS["amber"], "dash": "dash", "width": 1.5})
    fig.update_layout(
        title=f"How unusual is every claim? ({p['scope'].replace('_', ' ')})",
        xaxis_title="z-score", showlegend=False,
        yaxis={"tickvals": list(range(len(employees))),
               "ticktext": [name_of(names, e) for e in employees]},
    )
    return fig


TOOL = Tool(
    id="zscore", name="Z-Score Scan", cost=2, unlock_level=1,
    params={"scope": ["per_employee", "global"], "threshold": 3.0}, visual=True,
    analyze=analyze, chart=chart,
)
