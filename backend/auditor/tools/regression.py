import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import ttest_1samp
from sklearn.linear_model import LinearRegression

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame) -> Analysis:
    # Bigger deals cost more to win: fit log(expense) = slope * log(revenue) + intercept
    x = np.log10(df[["revenue"]].to_numpy())
    y = np.log10(df["amount"].to_numpy())
    model = LinearRegression().fit(x, y)
    residuals = y - model.predict(x)
    standardized = pd.Series(residuals / residuals.std(), index=df.index)

    # Does anyone sit systematically ABOVE the honest line? One-sided t-test per employee.
    stats: dict[str, float | str] = {"slope": float(model.coef_[0]),
                                     "intercept": float(model.intercept_),
                                     "r2": float(model.score(x, y))}
    for employee, resid in standardized.groupby(df["employee_id"]):
        stats[f"mean_resid_{employee}"] = round(float(resid.mean()), 4)
        stats[f"p_{employee}"] = float(ttest_1samp(resid, 0, alternative="greater").pvalue)
    employees = sorted(df["employee_id"].unique())
    implicates = [e for e in employees if stats[f"p_{e}"] < 0.001]

    return Analysis(
        title="Margin Model",
        summary=(
            f"Regression explains {stats['r2']:.0%} of expense size from deal revenue. "
            f"Living above the line (t-test p < 0.001): {', '.join(implicates) or 'nobody'}."
        ),
        stats=stats,
        implicates=implicates,
        table=pd.DataFrame({
            "employee_id": employees,
            "mean_residual": [stats[f"mean_resid_{e}"] for e in employees],
            "p_value": [stats[f"p_{e}"] for e in employees],
        }),
        plot_data={"x": x[:, 0].round(4).tolist(), "y": y.round(4).tolist(),
                   "employee": df["employee_id"].tolist(), "txn": df["txn_id"].tolist(),
                   "slope": stats["slope"], "intercept": stats["intercept"],
                   "implicates": implicates},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    p = a.plot_data
    frame = pd.DataFrame({k: p[k] for k in ("x", "y", "employee", "txn")})
    fig = go.Figure()
    for employee, rows in frame.groupby("employee"):
        bad = employee in p["implicates"]
        fig.add_trace(go.Scatter(
            x=rows["x"], y=rows["y"], mode="markers", name=name_of(names, employee),
            marker={"size": 7 if bad else 5, "opacity": 0.95 if bad else 0.35,
                    "color": COLORS["red"] if bad else COLORS["cyan"]},
            text=rows["txn"], hovertemplate="%{text}<br>log₁₀ revenue %{x:.2f}"
                                             "<br>log₁₀ expense %{y:.2f}<extra></extra>",
        ))
    xs = np.array([min(p["x"]), max(p["x"])])
    fig.add_trace(go.Scatter(x=xs, y=p["slope"] * xs + p["intercept"], mode="lines",
                             name="honest margin", line={"color": COLORS["amber"], "width": 3}))
    fig.update_layout(title="Expense vs the deal it served (log–log)",
                      xaxis_title="log₁₀ deal revenue", yaxis_title="log₁₀ expense")
    return fig


TOOL = Tool(id="regression", name="Margin Model", cost=4, unlock_level=5, params={},
            visual=True, analyze=analyze, chart=chart)
