import pandas as pd
import pytest

from auditor.autopsy import build_autopsy, player_table
from auditor.profiles import ARCHETYPES, assign_archetypes, profile_for
from tests.fixtures import synthetic_events

COLUMNS = ["n_tools", "distinct_tools", "budget_spent_ratio", "seconds_to_accuse", "correct",
           "visual_tool_share", "hacker_queries", "score"]


@pytest.fixture(scope="module")
def events():
    return synthetic_events(200, seed=0)


def test_player_table_shape(events):
    players = player_table(events)
    assert len(players) == 200 and list(players.columns) == COLUMNS
    assert players.index.name == "player_id"
    assert players["correct"].isin([0, 1]).all()
    assert players["seconds_to_accuse"].isna().any()  # some never accused


def test_autopsy_has_six_slides_with_code(events):
    slides = build_autopsy(events)
    assert [s.title for s in slides] == [
        "The verdicts", "Which tools did the class reach for?", "How long did it take?",
        "Does more analysis pay off?", "Which tool predicts success?", "Detective archetypes",
    ]
    for s in slides:
        assert "def " in s.code and s.figure["data"]


def test_tools_vs_accuracy_slide_stats(events):
    stats = build_autopsy(events)[3].stats
    assert stats["pearson_r"] > 0 and stats["p_value"] < 0.05


def test_verdict_slide_stats(events):
    stats = build_autopsy(events)[0].stats
    assert 0 < stats["solve_rate"] < 1 and stats["median_seconds"] > 0
    assert stats["players"] == 200


def test_archetypes_valid_and_deterministic(events):
    players = player_table(events)
    a, b = assign_archetypes(players), assign_archetypes(players)
    assert a.equals(b)
    assert set(a.unique()) == set(ARCHETYPES)


def test_small_class_fallback(events):
    players = player_table(events).head(5)
    labels = assign_archetypes(players)
    assert len(labels) == 5 and set(labels) <= set(ARCHETYPES)


def test_profile_for(events):
    profile = profile_for("P007", events, name="Asha")
    assert profile.archetype in ARCHETYPES and profile.name == "Asha"
    assert profile.tagline and profile.radar_figure["data"]
    assert {"n_tools", "correct", "score"} <= set(profile.stats)


def test_profile_unknown_player(events):
    with pytest.raises(KeyError):
        profile_for("nobody", events)


def test_autopsy_empty_room():
    empty = pd.DataFrame(columns=["ts", "type", "player_id", "case_id", "room_code", "tool_id",
                                  "payload"])
    slides = build_autopsy(empty)
    assert len(slides) == 1 and slides[0].title == "No detectives yet"
