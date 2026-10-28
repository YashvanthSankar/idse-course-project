import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import chisquare

from auditor.charts import COLORS, name_of
from auditor.tools.base import Analysis, Tool

DIGITS = np.arange(1, 10)
BENFORD = np.log10(1 + 1 / DIGITS)  # P(first digit = d) in real-world money
MIN_CLAIMS = 50
ALPHA = 1e-5  # very strong evidence: honest ledgers drift a little, forgers drift a lot


def analyze(df: pd.DataFrame) -> Analysis:
    # First significant digit: 4,812.50 -> 4 ; 129.00 -> 1 ; 23,400 -> 2
    first_digit = (df["amount"] / 10 ** np.floor(np.log10(df["amount"]))).astype(int)

    stats: dict[str, float | str] = {}
    observed: dict[str, list[float]] = {}
    for employee, digits in first_digit.groupby(df["employee_id"]):
        counts = digits.value_counts().reindex(DIGITS, fill_value=0).to_numpy()
        n = int(counts.sum())
        observed[employee] = (counts / n).round(4).tolist()
        stats[f"n_{employee}"] = n
        if n < MIN_CLAIMS:
            stats[f"verdict_{employee}"] = "inconclusive"  # too few claims to judge
            continue
        p = chisquare(counts, BENFORD * n).pvalue  # does this ledger follow Benford?
        stats[f"p_{employee}"] = float(p)
        stats[f"verdict_{employee}"] = "suspicious" if p < ALPHA else "conforms"

    implicates = sorted(e for e in observed if stats[f"verdict_{e}"] == "suspicious")
    return Analysis(
        title="Benford's Law",
        summary=(
            f"Real money starts with a 1 about 30% of the time. Ledgers that break the "
            f"pattern (chi-square p < 0.00001): {', '.join(implicates) or 'none'}."
        ),
        stats=stats,
        implicates=implicates,
        table=pd.DataFrame({"digit": DIGITS, "benford": BENFORD.round(4),
                            **{e: v for e, v in observed.items()}}),
        plot_data={"expected": BENFORD.tolist(), "observed": observed, "implicates": implicates},
    )


def chart(a: Analysis, names: dict[str, str] | None = None) -> go.Figure:
    fig = go.Figure(go.Bar(
        x=DIGITS, y=a.plot_data["expected"], name="Benford (honest money)",
        marker_color="rgba(245,165,36,0.35)", marker_line={"color": COLORS["amber"], "width": 1.5},
        hovertemplate="digit %{x}: %{y:.1%} expected<extra></extra>",
    ))
    for employee, shares in a.plot_data["observed"].items():
        bad = employee in a.plot_data["implicates"]
        fig.add_trace(go.Scatter(
            x=DIGITS, y=shares, mode="lines+markers", name=name_of(names, employee),
            line={"color": COLORS["red"] if bad else COLORS["cyan"], "width": 3.5 if bad else 1.2},
            opacity=1 if bad else 0.45,
            hovertemplate=f"{name_of(names, employee)}<br>digit %{{x}}: %{{y:.1%}}<extra></extra>",
        ))
    fig.update_layout(title="First-digit fingerprint vs Benford's law",
                      xaxis={"title": "first digit", "dtick": 1},
                      yaxis={"title": "share of claims", "tickformat": ".0%"})
    return fig


TOOL = Tool(id="benford", name="Benford's Law", cost=3, unlock_level=3, params={}, visual=True,
            analyze=analyze, chart=chart)
