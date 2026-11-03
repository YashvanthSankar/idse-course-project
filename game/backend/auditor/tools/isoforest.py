import numpy as np
import pandas as pd
import plotly.graph_objects as go
from sklearn.ensemble import IsolationForest

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool


def analyze(df: pd.DataFrame) -> Analysis:
    # Describe every claim with three behaviour features, then let the forest isolate the weird ones
    log_amount = np.log10(df["amount"])
    features = pd.DataFrame({
        "unusual_size": log_amount - log_amount.groupby(
            [df["employee_id"], df["category"]]).transform("median"),
        "hour": df["hour"],
        "vendor_popularity": df["vendor"].map(df["vendor"].value_counts(normalize=True)),
    })
    forest = IsolationForest(n_estimators=200, contamination=0.02, random_state=0)
    flagged = forest.fit_predict(features) == -1
    score = -forest.score_samples(features)  # higher = easier to isolate = stranger

    # Who owns a suspicious share of the strange claims?
    share = pd.Series(flagged, index=df.index).groupby(df["employee_id"]).mean()
    count = pd.Series(flagged, index=df.index).groupby(df["employee_id"]).sum()
    typical = share.median()
    implicates = sorted(share[(count >= 6) & (share > 3 * typical)].index)

    return Analysis(
        title="Anomaly Hunter · Isolation Forest",
        summary=(
            f"The forest isolated {int(flagged.sum())} strange claims. Owning far more than "
            f"their share: {', '.join(implicates) or 'nobody'}."
        ),
        stats={"flagged_rows": int(flagged.sum()),
               **{f"flagged_{e}": int(n) for e, n in count.items()},
               **{f"flagged_share_{e}": round(float(s), 4) for e, s in share.items()}},
        implicates=implicates,
        table=df.loc[flagged, ["txn_id", "employee_id", "vendor", "amount", "hour"]]
        .assign(anomaly_score=score[flagged].round(3)).sort_values("anomaly_score",
                                                                   ascending=False),
        plot_data={"amount": df["amount"].tolist(), "hour": df["hour"].tolist(),
                   "score": score.round(4).tolist(), "flagged": flagged.tolist(),
                   "employee": df["employee_id"].tolist(), "txn": df["txn_id"].tolist(),
                   "vendor": df["vendor"].tolist()},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    p = a.plot_data
    flagged = np.array(p["flagged"])
    jitter = np.random.default_rng(0).uniform(-0.3, 0.3, len(flagged))
    hour = np.array(p["hour"]) + jitter
    labels = [name_of(names, e) for e in p["employee"]]
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=hour[~flagged], y=np.array(p["amount"])[~flagged], mode="markers", name="ordinary",
        marker={"size": 5, "opacity": 0.4, "color": np.array(p["score"])[~flagged],
                "colorscale": [[0, COLORS["ink_800"]], [1, COLORS["cyan"]]]},
        hoverinfo="skip",
    ))
    fig.add_trace(go.Scatter(
        x=hour[flagged], y=np.array(p["amount"])[flagged], mode="markers", name="isolated",
        marker={"size": 12, "color": COLORS["red"], "symbol": "x"},
        customdata=np.column_stack([np.array(p["txn"])[flagged], np.array(labels)[flagged],
                                    np.array(p["vendor"])[flagged]]),
        hovertemplate="%{customdata[0]} · %{customdata[1]}<br>%{customdata[2]}"
                      "<br>₹%{y:,.0f} at %{x:.0f}:00<extra></extra>",
    ))
    fig.add_hline(y=50_000, line={"color": COLORS["amber"], "dash": "dot"},
                  annotation_text="₹50k approval limit", annotation_font_color=COLORS["amber"])
    fig.update_layout(title="What the forest found strange",
                      xaxis={"title": "hour of day", "range": [-0.5, 23.5], "dtick": 3},
                      yaxis={"title": "₹ amount", "type": "log"})
    return fig


TOOL = Tool(id="isoforest", name="Anomaly Hunter", cost=5, unlock_level=6, params={},
            visual=True, analyze=analyze, chart=chart)
