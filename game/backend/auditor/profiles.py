"""Detective Cards: KMeans sorts players into four play styles."""

import pandas as pd
import plotly.graph_objects as go
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from auditor.autopsy import player_table
from auditor.charts import COLORS, fig_to_json
from auditor.models import Profile

ARCHETYPES = ["The Statistician", "The Gambler", "The Hacker", "The Visualizer"]
TAGLINES = {
    "The Statistician": "Tests every hypothesis. Trusts p-values more than people.",
    "The Gambler": "One hunch, one tool, one shot. Lives fast, accuses faster.",
    "The Hacker": "Skips the menus and writes the pandas query by hand.",
    "The Visualizer": "If it can't be plotted, it isn't evidence.",
}
FEATURES = ["n_tools", "distinct_tools", "budget_spent_ratio", "seconds_to_accuse", "correct",
            "visual_tool_share", "hacker_queries"]
MIN_FOR_CLUSTERING = 8


def _rule_based(players: pd.DataFrame) -> pd.Series:
    def label(p: pd.Series) -> str:
        if p["hacker_queries"] >= 3:
            return "The Hacker"
        if p["n_tools"] <= 2:
            return "The Gambler"
        if p["correct"] and p["distinct_tools"] >= 3:
            return "The Statistician"
        return "The Visualizer"

    return players.apply(label, axis=1)


def assign_archetypes(players: pd.DataFrame) -> pd.Series:
    X = players[FEATURES].copy()
    slowest = X["seconds_to_accuse"].max()
    X["seconds_to_accuse"] = X["seconds_to_accuse"].fillna(0 if pd.isna(slowest) else slowest)
    if len(players) < MIN_FOR_CLUSTERING or len(X.drop_duplicates()) < 4:
        return _rule_based(players)  # too few (distinct) detectives to cluster
    scaled = StandardScaler().fit_transform(X)
    clusters = KMeans(n_clusters=4, n_init=10, random_state=0).fit_predict(scaled)

    # Name each cluster by what its centre looks like (in z-score units)
    centres = pd.DataFrame(scaled, columns=FEATURES).groupby(clusters).mean()
    names: dict[int, str] = {}
    remaining = list(centres.index)
    for archetype, score in [
        ("The Hacker", centres["hacker_queries"]),
        ("The Statistician", centres["correct"] + centres["distinct_tools"]),
        ("The Gambler", -centres["n_tools"] - centres["seconds_to_accuse"]),
    ]:
        best = score.loc[remaining].idxmax()
        names[best] = archetype
        remaining.remove(best)
    names[remaining[0]] = "The Visualizer"
    return pd.Series([names[c] for c in clusters], index=players.index, name="archetype")


def profile_for(player_id: str, events: pd.DataFrame, name: str = "Detective") -> Profile:
    players = player_table(events)
    if player_id not in players.index:
        raise KeyError(player_id)
    archetype = assign_archetypes(players).loc[player_id]
    me = players.loc[player_id]

    axes = ["n_tools", "distinct_tools", "budget_spent_ratio", "correct", "visual_tool_share"]
    labels = ["Tools run", "Variety", "Budget used", "Accuracy", "Charts"]
    span = (players[axes].max() - players[axes].min()).replace(0, 1)
    mine = ((me[axes] - players[axes].min()) / span).round(3).tolist()
    avg = ((players[axes].mean() - players[axes].min()) / span).round(3).tolist()
    fig = go.Figure([
        go.Scatterpolar(r=avg + avg[:1], theta=labels + labels[:1], name="class average",
                        line={"color": COLORS["muted"]}, fill="toself",
                        fillcolor="rgba(139,147,163,0.15)"),
        go.Scatterpolar(r=mine + mine[:1], theta=labels + labels[:1], name=name,
                        line={"color": COLORS["amber"], "width": 3}, fill="toself",
                        fillcolor="rgba(245,165,36,0.25)"),
    ])
    fig.update_layout(polar={"bgcolor": "rgba(0,0,0,0)",
                             "radialaxis": {"visible": False, "range": [0, 1]},
                             "angularaxis": {"gridcolor": COLORS["line"]}},
                      showlegend=False, margin={"l": 40, "r": 40, "t": 20, "b": 20})
    stats = {k: float(v) for k, v in me.items() if pd.notna(v)}
    return Profile(player_id=player_id, name=name, archetype=archetype,
                   tagline=TAGLINES[archetype], stats=stats, radar_figure=fig_to_json(fig))
