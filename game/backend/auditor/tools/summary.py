import pandas as pd
import plotly.graph_objects as go

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame) -> Analysis:
    # describe() gives count, mean, std, min, quartiles and max for every employee
    by_employee = df.groupby("employee_id")["amount"]
    table = by_employee.describe()[["count", "mean", "std", "min", "50%", "max"]]
    table["total"] = by_employee.sum()
    table = table.rename(columns={"50%": "median"}).round(2).reset_index()

    top = table.loc[table["total"].idxmax()]
    return Analysis(
        title="Case Summary",
        summary=(
            f"{len(df):,} transactions worth ₹{df['amount'].sum():,.0f} across "
            f"{df['employee_id'].nunique()} employees. Biggest spender: "
            f"{top['employee_id']} with ₹{top['total']:,.0f}."
        ),
        stats={"n_rows": len(df), "total_spend": round(float(df["amount"].sum()), 2)},
        implicates=[],  # a summary describes — it never accuses
        table=table,
        plot_data={"employees": table["employee_id"].tolist(), "totals": table["total"].tolist(),
                   "counts": table["count"].tolist(), "medians": table["median"].tolist()},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    labels = [name_of(names, e) for e in a.plot_data["employees"]]
    fig = go.Figure(go.Bar(
        x=a.plot_data["totals"], y=labels, orientation="h", marker_color=COLORS["amber"],
        customdata=list(zip(a.plot_data["counts"], a.plot_data["medians"])),
        hovertemplate="<b>%{y}</b><br>Total ₹%{x:,.0f}<br>%{customdata[0]:.0f} claims"
                      "<br>Median ₹%{customdata[1]:,.0f}<extra></extra>",
    ))
    fig.update_layout(title="Total spend per employee", xaxis_title="₹ total", bargap=0.35)
    return fig


TOOL = Tool(id="summary", name="Case Summary", cost=1, unlock_level=1, params={}, visual=False,
            analyze=analyze, chart=chart)
