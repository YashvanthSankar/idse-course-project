import pandas as pd
import plotly.graph_objects as go

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame) -> Analysis:
    # Pair every claim with every other claim by the same person, vendor and exact amount
    claims = df[["txn_id", "employee_id", "vendor", "amount", "date"]].assign(
        date=pd.to_datetime(df["date"])
    )
    pairs = claims.merge(claims, on=["employee_id", "vendor", "amount"], suffixes=("_a", "_b"))
    gap = (pairs["date_b"] - pairs["date_a"]).dt.days
    twins = pairs[(gap > 0) & (gap <= 7)]  # the same bill again, within a week

    per_employee = twins["employee_id"].value_counts()
    implicates = sorted(per_employee[per_employee >= 3].index)
    table = twins[["employee_id", "vendor", "amount", "date_a", "date_b"]].assign(
        date_a=twins["date_a"].dt.date.astype(str), date_b=twins["date_b"].dt.date.astype(str)
    )
    return Analysis(
        title="Twin Finder",
        summary=(
            f"{len(twins)} twin invoice pair(s): same person, same vendor, same amount, "
            f"within 7 days. Repeat offenders: {', '.join(implicates) or 'nobody'}."
        ),
        stats={"twin_pairs": len(twins), **{f"pairs_{e}": int(n) for e, n in per_employee.items()}},
        implicates=implicates,
        table=table.reset_index(drop=True),
        plot_data={"pairs": table.to_dict("records"),
                   "employees": sorted(df["employee_id"].unique())},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    fig = go.Figure()
    for i, pair in enumerate(a.plot_data["pairs"]):
        label = name_of(names, pair["employee_id"])
        fig.add_trace(go.Scatter(
            x=[pair["date_a"], pair["date_b"]], y=[label, label], mode="lines+markers",
            line={"color": COLORS["red"], "width": 3}, showlegend=False,
            marker={"size": 11, "color": [COLORS["amber"], COLORS["red"]],
                    "symbol": ["circle", "diamond"]},
            hovertemplate=f"{pair['vendor']}<br>₹{pair['amount']:,.2f}<br>%{{x}}<extra></extra>",
        ))
    fig.update_layout(
        title="Twin invoices — original ● and copy ◆",
        yaxis={"categoryorder": "array",
               "categoryarray": [name_of(names, e) for e in a.plot_data["employees"]]},
        xaxis_title="date",
    )
    if not a.plot_data["pairs"]:
        fig.add_annotation(text="No twins found", showarrow=False,
                           font={"size": 16, "color": COLORS["muted"]})
    return fig


TOOL = Tool(id="duplicates", name="Twin Finder", cost=2, unlock_level=2, params={},
            visual=True, analyze=analyze, chart=chart)
