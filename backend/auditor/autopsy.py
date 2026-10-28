"""The Class Autopsy: pandas turns the classroom's own play data into a slide deck."""

import inspect
from dataclasses import dataclass

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import chi2_contingency, pearsonr

from auditor.charts import COLORS, fig_to_json
from auditor.generator.cases import LEVELS
from auditor.tools.registry import TOOLS


@dataclass
class Slide:
    title: str
    figure: dict
    code: str
    stats: dict


def player_table(events: pd.DataFrame) -> pd.DataFrame:
    """One row per detective, built from the raw click log."""
    tools = events[events["type"] == "tool_run"]
    accused = events[events["type"] == "accused"].drop_duplicates("player_id", keep="first")
    started = events[events["type"] == "case_started"].drop_duplicates("player_id")

    budget = started.set_index("player_id")["payload"].map(
        lambda p: LEVELS[p.get("level", 1)].budget)
    spent = tools.assign(cost=tools["payload"].map(lambda p: p.get("cost", 0))) \
        .groupby("player_id")["cost"].sum()
    visual = tools["payload"].map(lambda p: p.get("visual", True)).groupby(
        tools["player_id"]).mean()
    verdicts = accused.set_index("player_id")["payload"]

    players = pd.DataFrame(index=pd.Index(sorted(events["player_id"].dropna().unique()),
                                          name="player_id"))
    players["n_tools"] = tools.groupby("player_id").size()
    players["distinct_tools"] = tools.groupby("player_id")["tool_id"].nunique()
    players["budget_spent_ratio"] = (spent / budget).round(3)
    players["seconds_to_accuse"] = verdicts.map(lambda p: p.get("elapsed_s")).astype(float)
    players["correct"] = verdicts.map(lambda p: int(bool(p.get("correct"))))
    players["visual_tool_share"] = visual.round(3)
    players["hacker_queries"] = events[events["type"] == "hacker_query"].groupby(
        "player_id").size()
    players["score"] = verdicts.map(lambda p: p.get("score", 0))
    fill = {c: 0 for c in players.columns if c != "seconds_to_accuse"}
    players = players.fillna(fill)
    for col in ("n_tools", "distinct_tools", "correct", "hacker_queries", "score"):
        players[col] = players[col].astype(int)
    return players


def verdict_slide(players: pd.DataFrame) -> Slide:
    accused = players["seconds_to_accuse"].notna()
    counts = {"Caught the fraudster": int(players["correct"].sum()),
              "Accused an innocent": int((accused & (players["correct"] == 0)).sum()),
              "Never accused": int((~accused).sum())}
    fig = go.Figure(go.Bar(x=list(counts), y=list(counts.values()),
                           marker_color=[COLORS["green"], COLORS["red"], COLORS["muted"]],
                           text=list(counts.values()), textposition="outside"))
    fig.update_layout(title="How the class did", yaxis_title="detectives")
    return Slide("The verdicts", fig_to_json(fig), inspect.getsource(verdict_slide), {
        "players": len(players),
        "solve_rate": round(float(players["correct"].mean()), 3),
        "median_seconds": float(players["seconds_to_accuse"].median()),
    })


def tool_usage_slide(events: pd.DataFrame) -> Slide:
    usage = events[events["type"] == "tool_run"]["tool_id"].value_counts()
    names = [TOOLS[t].name for t in usage.index]
    fig = go.Figure(go.Bar(x=usage.to_numpy(), y=names, orientation="h",
                           marker_color=COLORS["amber"]))
    fig.update_layout(title="Tool runs across the whole class",
                      yaxis={"autorange": "reversed"}, xaxis_title="times used")
    return Slide("Which tools did the class reach for?", fig_to_json(fig),
                 inspect.getsource(tool_usage_slide),
                 {"most_used": names[0] if names else "none", "total_runs": int(usage.sum())})


def timing_slide(players: pd.DataFrame) -> Slide:
    fig = go.Figure()
    for correct, label, color in [(1, "right", COLORS["green"]), (0, "wrong", COLORS["red"])]:
        times = players.loc[players["correct"] == correct, "seconds_to_accuse"].dropna()
        fig.add_trace(go.Histogram(x=times, name=label, marker_color=color, opacity=0.75,
                                   nbinsx=20))
    fig.update_layout(title="Seconds until the accusation", barmode="overlay",
                      xaxis_title="seconds", yaxis_title="detectives")
    right = players.loc[players["correct"] == 1, "seconds_to_accuse"]
    wrong = players.loc[(players["correct"] == 0), "seconds_to_accuse"]
    return Slide("How long did it take?", fig_to_json(fig), inspect.getsource(timing_slide), {
        "median_right": float(right.median()) if right.notna().any() else 0.0,
        "median_wrong": float(wrong.median()) if wrong.notna().any() else 0.0,
    })


def analysis_pays_slide(players: pd.DataFrame) -> Slide:
    # Pearson correlation between how many tools you ran and whether you were right
    r, p = pearsonr(players["n_tools"], players["correct"])
    by_tools = players.groupby(players["n_tools"].clip(upper=10))["correct"].agg(["mean", "size"])
    jitter = np.random.default_rng(0).uniform(-0.08, 0.08, len(players))
    fig = go.Figure([
        go.Scatter(x=players["n_tools"], y=players["correct"] + jitter, mode="markers",
                   name="one detective", marker={"color": COLORS["cyan"], "opacity": 0.35}),
        go.Scatter(x=by_tools.index, y=by_tools["mean"], mode="lines+markers",
                   name="share who were right", line={"color": COLORS["amber"], "width": 3}),
    ])
    fig.update_layout(title=f"More tools, more truth? r = {r:.2f}, p = {p:.3g}",
                      xaxis_title="tools run", yaxis={"title": "right (1) / wrong (0)",
                                                      "range": [-0.2, 1.2]})
    return Slide("Does more analysis pay off?", fig_to_json(fig),
                 inspect.getsource(analysis_pays_slide),
                 {"pearson_r": round(float(r), 3), "p_value": float(p)})


def predictive_tool_slide(events: pd.DataFrame, players: pd.DataFrame) -> Slide:
    tools = events[events["type"] == "tool_run"]
    rows = []
    for tool_id, group in tools.groupby("tool_id"):
        used = players.index.isin(group["player_id"])
        users, others = players.loc[used, "correct"], players.loc[~used, "correct"]
        if len(users) == 0 or len(others) == 0:
            continue
        # 2x2 table: used the tool? x got it right?
        table = [[users.sum(), len(users) - users.sum()], [others.sum(), len(others) - others.sum()]]
        p = chi2_contingency(table).pvalue if np.min(table) > 0 else 1.0
        rows.append((TOOLS[tool_id].name, users.mean(), others.mean(), p))
    result = pd.DataFrame(rows, columns=["tool", "users", "non_users", "p"]).sort_values(
        "users", ascending=False)
    fig = go.Figure([
        go.Bar(x=result["tool"], y=result["users"], name="used it",
               marker_color=COLORS["amber"]),
        go.Bar(x=result["tool"], y=result["non_users"], name="didn't",
               marker_color=COLORS["muted"]),
    ])
    fig.update_layout(title="Success rate: tool users vs everyone else", barmode="group",
                      yaxis={"tickformat": ".0%"})
    best = result.sort_values("p").iloc[0] if len(result) else None
    return Slide("Which tool predicts success?", fig_to_json(fig),
                 inspect.getsource(predictive_tool_slide),
                 {"best_tool": best["tool"] if best is not None else "none",
                  "best_p": float(best["p"]) if best is not None else 1.0})


def archetype_slide(players: pd.DataFrame) -> Slide:
    from auditor.profiles import assign_archetypes  # local import: profiles imports this module

    counts = assign_archetypes(players).value_counts()
    fig = go.Figure(go.Pie(labels=counts.index, values=counts.to_numpy(), hole=0.55,
                           marker={"colors": [COLORS["amber"], COLORS["cyan"], COLORS["red"],
                                              COLORS["green"]]}))
    fig.update_layout(title="KMeans sorted the class into four kinds of detective")
    return Slide("Detective archetypes", fig_to_json(fig), inspect.getsource(archetype_slide),
                 {k: int(v) for k, v in counts.items()})


def build_autopsy(events: pd.DataFrame) -> list[Slide]:
    if events.empty or events["player_id"].dropna().empty:
        fig = go.Figure()
        fig.add_annotation(text="Waiting for the class to play…", showarrow=False,
                           font={"size": 22, "color": COLORS["muted"]})
        return [Slide("No detectives yet", fig_to_json(fig), inspect.getsource(build_autopsy),
                      {})]
    players = player_table(events)
    return [
        verdict_slide(players),
        tool_usage_slide(events),
        timing_slide(players),
        analysis_pays_slide(players),
        predictive_tool_slide(events, players),
        archetype_slide(players),
    ]
