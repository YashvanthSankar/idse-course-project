"""The 'noir' Plotly theme: every chart in the game is built here in Python."""

import json

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio

COLORS = {
    "ink_950": "#07080B",
    "ink_900": "#0E1117",
    "ink_800": "#161B24",
    "line": "#2A3140",
    "paper": "#EFE6D2",
    "amber": "#F5A524",
    "red": "#E5484D",
    "green": "#3DD68C",
    "cyan": "#4CC9F0",
    "text": "#E8E6E1",
    "muted": "#8B93A3",
}
COLORWAY = [COLORS[c] for c in ("amber", "cyan", "paper", "green", "red", "muted")]
TRANSPARENT = "rgba(0,0,0,0)"


def register_noir_template() -> None:
    if "noir" in pio.templates:
        pio.templates.default = "noir"
        return
    axis = {
        "gridcolor": COLORS["line"],
        "linecolor": COLORS["line"],
        "zeroline": False,
        "tickfont": {"color": COLORS["muted"], "size": 11},
        "title": {"font": {"color": COLORS["muted"], "size": 12}},
    }
    pio.templates["noir"] = go.layout.Template(
        layout={
            "paper_bgcolor": TRANSPARENT,
            "plot_bgcolor": TRANSPARENT,
            "colorway": COLORWAY,
            "font": {"family": "Inter, system-ui, sans-serif", "color": COLORS["text"], "size": 12},
            "title": {"font": {"family": "Playfair Display, serif", "size": 18}},
            "xaxis": axis,
            "yaxis": axis,
            "margin": {"l": 56, "r": 20, "t": 40, "b": 48},
            "hoverlabel": {
                "bgcolor": COLORS["ink_800"],
                "bordercolor": COLORS["amber"],
                "font": {"family": "JetBrains Mono, monospace", "color": COLORS["text"]},
            },
            "legend": {"orientation": "h", "y": 1.08, "x": 0, "bgcolor": TRANSPARENT},
        }
    )
    pio.templates.default = "noir"


def _deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for key, value in over.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def fig_to_json(fig: go.Figure) -> dict:
    """Plain JSON for the browser, with the noir theme baked into the layout."""
    data = json.loads(fig.to_json())
    own = data.get("layout", {})
    own.pop("template", None)
    theme = pio.templates["noir"].layout.to_plotly_json()
    layout = _deep_merge(theme, own)
    for key in [k for k in own if k.startswith(("xaxis", "yaxis")) and k not in theme]:
        layout[key] = _deep_merge(theme["xaxis"], own[key])
    return {"data": data.get("data", []), "layout": layout}


def name_of(names: dict[str, str] | None, employee_id: str) -> str:
    return (names or {}).get(employee_id, employee_id)


register_noir_template()


def reveal_figure(df: pd.DataFrame, fraudster_id: str, fraud_txn_ids: list[str],
                  names: dict[str, str] | None = None) -> dict:
    """The Reveal: every claim in the ledger, the fraudster's in amber, the crimes in red."""
    dates = pd.to_datetime(df["date"]) + pd.to_timedelta(df["hour"], unit="h")
    is_fraud = df["txn_id"].isin(fraud_txn_ids)
    theirs = df["employee_id"] == fraudster_id
    fig = go.Figure()
    for mask, name, color, size, opacity in [
        (~theirs, "everyone else", COLORS["muted"], 4, 0.25),
        (theirs & ~is_fraud, f"{name_of(names, fraudster_id)} (honest claims)", COLORS["amber"],
         6, 0.6),
    ]:
        fig.add_trace(go.Scattergl(x=dates[mask], y=df.loc[mask, "amount"], mode="markers",
                                   name=name, marker={"color": color, "size": size,
                                                      "opacity": opacity}, hoverinfo="skip"))
    fraud = df[is_fraud]
    fig.add_trace(go.Scatter(
        x=dates[is_fraud], y=fraud["amount"], mode="markers", name="the fraud",
        marker={"color": COLORS["red"], "size": 13, "symbol": "x",
                "line": {"width": 1, "color": "#fff"}},
        customdata=fraud[["txn_id", "vendor", "category"]].to_numpy(),
        hovertemplate="%{customdata[0]} · %{customdata[1]}<br>%{customdata[2]} · ₹%{y:,.0f}"
                      "<extra></extra>",
    ))
    fig.update_layout(title="How they did it", yaxis={"type": "log", "title": "₹ amount"},
                      xaxis_title="date")
    return fig_to_json(fig)
