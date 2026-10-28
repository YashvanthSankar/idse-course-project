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
                   "shares": {e: round(float(v), 4) for e, v in weekend_share.items()},
                   "weekend_points": {
                       e: rows[["date", "amount"]].assign(date=rows["date"].dt.strftime("%Y-%m-%d"))
                       .to_dict("list")
                       for e, rows in dated[dated["weekend"]].groupby("employee_id")
                   }},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    """One row per person, one dot per weekend claim: the weekend spender's row fills up."""
    p = a.plot_data
    shares = p["shares"]
    employees = sorted(shares, key=lambda e: shares[e])  # most weekend-heavy on top
    label = {e: f"{name_of(names, e)} · {shares[e]:.0%}" for e in employees}
    fig = go.Figure()

    start, end = pd.to_datetime(p["dates"][0]), pd.to_datetime(p["dates"][-1])
    for day in pd.date_range(start, end, freq="D"):
        if day.day_of_week == 5:  # shade every weekend: the office is closed
            fig.add_vrect(x0=day, x1=day + pd.Timedelta(days=2),
                          fillcolor="rgba(76,201,240,0.07)", line_width=0, layer="below")

    # invisible anchor so people with zero weekend claims still get their (empty) row
    fig.add_trace(go.Scatter(x=[start] * len(employees), y=[label[e] for e in employees],
                             mode="markers", marker={"opacity": 0}, hoverinfo="skip",
                             showlegend=False))
    for employee in employees:
        pts = p["weekend_points"].get(employee)
        if not pts:
            continue
        bad = employee in p["implicates"]
        color = COLORS["red"] if bad else COLORS["cyan"]
        if p["freq"] == "W":
            weeks = pd.to_datetime(pd.Series(pts["date"])).dt.to_period("W").dt.start_time
            counts = weeks.value_counts().sort_index()
            fig.add_trace(go.Scatter(
                x=counts.index, y=[label[employee]] * len(counts), mode="markers",
                marker={"color": color, "size": [8 + 6 * c for c in counts], "opacity": 0.85},
                customdata=counts.to_numpy(), showlegend=False,
                hovertemplate="week of %{x|%d %b}: %{customdata} weekend claim(s)<extra></extra>",
            ))
        else:
            fig.add_trace(go.Scatter(
                x=pts["date"], y=[label[employee]] * len(pts["date"]), mode="markers",
                marker={"color": color, "size": 12 if bad else 8, "symbol": "diamond",
                        "line": {"width": 1, "color": COLORS["ink_950"]}},
                customdata=pts["amount"], showlegend=False,
                hovertemplate="%{x|%a %d %b}<br>₹%{customdata:,.0f}<extra></extra>",
            ))
    fig.update_layout(
        title="Weekend claims per person (weekends shaded) · % = share of their claims",
        xaxis={"range": [start, end + pd.Timedelta(days=1)]},
        yaxis={"categoryorder": "array", "categoryarray": [label[e] for e in employees],
               "type": "category"},
    )
    return fig


TOOL = Tool(id="timeseries", name="Timeline", cost=3, unlock_level=4, params={"freq": ["D", "W"]},
            visual=True, analyze=analyze, chart=chart)
