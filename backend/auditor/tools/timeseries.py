import pandas as pd
import plotly.graph_objects as go
from scipy.stats import binomtest

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame, freq: str = "D") -> Analysis:
    dated = df.assign(date=pd.to_datetime(df["date"]))
    dated["weekend"] = dated["date"].dt.day_of_week >= 5  # the office is closed Sat & Sun

    # Spend over time for every employee (daily or weekly buckets)
    spend = (dated.set_index("date").groupby("employee_id")["amount"]
             .resample(freq).sum().unstack(0).fillna(0))

    weekend_share = dated.groupby("employee_id")["weekend"].mean()
    weekend_count = dated.groupby("employee_id")["weekend"].sum()
    company_median = weekend_share.median()

    # Binomial test: given everyone else's weekend rate, how surprising is this count?
    p_values = {}
    for employee, rows in dated.groupby("employee_id"):
        others_rate = dated.loc[dated["employee_id"] != employee, "weekend"].mean()
        test = binomtest(int(rows["weekend"].sum()), len(rows), others_rate, alternative="greater")
        p_values[employee] = float(test.pvalue)
    implicates = sorted(e for e, p in p_values.items() if p < 0.001)
    return Analysis(
        title=f"Timeline · {'daily' if freq == 'D' else 'weekly'}",
        summary=(
            f"Typical employee files {company_median:.0%} of claims on weekends. "
            f"Card active while the office sleeps: {', '.join(implicates) or 'nobody unusual'}."
        ),
        stats={"company_median_weekend_share": round(float(company_median), 4),
               **{f"weekend_share_{e}": round(float(s), 4) for e, s in weekend_share.items()},
               **{f"weekend_claims_{e}": int(n) for e, n in weekend_count.items()},
               **{f"p_{e}": p for e, p in p_values.items()}},
        implicates=implicates,
        table=pd.DataFrame({"weekend_share": weekend_share.round(4),
                            "weekend_claims": weekend_count}).reset_index(),
        plot_data={"dates": spend.index.strftime("%Y-%m-%d").tolist(),
                   "series": {e: spend[e].round(2).tolist() for e in spend.columns},
                   "freq": freq, "implicates": implicates,
                   "weekend_points": {
                       e: rows[["date", "amount"]].assign(date=rows["date"].dt.strftime("%Y-%m-%d"))
                       .to_dict("list")
                       for e, rows in dated[dated["weekend"]].groupby("employee_id")
                   }},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    p = a.plot_data
    fig = go.Figure()
    dates = pd.to_datetime(p["dates"])
    if p["freq"] == "D":
        for day in dates[dates.day_of_week == 5]:
            fig.add_vrect(x0=day - pd.Timedelta(hours=12), x1=day + pd.Timedelta(hours=36),
                          fillcolor="rgba(76,201,240,0.08)", line_width=0, layer="below")
    for employee, values in p["series"].items():
        bad = employee in p["implicates"]
        fig.add_trace(go.Scatter(
            x=p["dates"], y=values, mode="lines", name=name_of(names, employee),
            line={"color": COLORS["red"] if bad else COLORS["muted"], "width": 2.5 if bad else 1},
            opacity=1 if bad else 0.5,
        ))
    for employee, pts in p["weekend_points"].items():
        bad = employee in p["implicates"]
        fig.add_trace(go.Scatter(
            x=pts["date"], y=pts["amount"], mode="markers", showlegend=False,
            marker={"color": COLORS["red"] if bad else COLORS["cyan"], "size": 9 if bad else 5,
                    "symbol": "diamond"},
            hovertemplate=f"{name_of(names, employee)} · weekend claim<br>%{{x}} ₹%{{y:,.0f}}"
                          "<extra></extra>",
        ))
    fig.update_layout(title="Spending over time — weekends shaded, weekend claims ◆",
                      yaxis={"title": "₹ spend", "type": "log"})
    return fig


TOOL = Tool(id="timeseries", name="Timeline", cost=3, unlock_level=4, params={"freq": ["D", "W"]},
            visual=True, analyze=analyze, chart=chart)
