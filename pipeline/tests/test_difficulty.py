import numpy as np
import pandas as pd

from tareekh.difficulty import (
    difficulty_table,
    hearing_gap,
    score_group,
    stage_days,
    stage_summary,
    stuck_at,
)


def test_score_group_compares_with_always_guessing_the_commonest_answer():
    s = score_group(pd.Series([1, 1, 1, 0]), pd.Series([0.9, 0.8, 0.2, 0.1]))
    assert s["accuracy"] == 0.75 and s["majority_accuracy"] == 0.75 and s["share_yes"] == 0.75


def test_easy_and_contested_are_scored_separately():
    test = pd.DataFrame({"case_type": ["stc", "stc", "os", "os"], "y": [1, 0, 1, 0], "p": [0.9, 0.1, 0.1, 0.9]})
    out = difficulty_table(test, min_cases=1)
    assert out["easy"]["accuracy"] == 1.0 and out["contested"]["accuracy"] == 0.0
    assert {r["case_type"] for r in out["by_type"]} == {"stc", "os"}


def frame(rows):
    df = pd.DataFrame(rows, columns=["date_of_filing", "date_first_list", "observed_days", "ended"])
    for c in ("date_of_filing", "date_first_list"):
        df[c] = pd.to_datetime(df[c])
    return df


def test_stages_split_the_case_at_the_first_hearing():
    df = frame([("2016-01-01", "2016-01-31", 100, True)])
    row = stage_days(df).iloc[0]
    assert row.wait_first_hearing == 30 and row.after_first_hearing == 70


def test_blank_or_impossible_first_hearings_are_not_counted():
    df = frame([("2016-01-10", None, 100, True), ("2016-01-10", "2016-01-01", 100, True)])
    stages = stage_days(df)
    assert stages["wait_first_hearing"].isna().all() and stages["after_first_hearing"].isna().all()


def test_still_running_cases_count_towards_time_after_the_first_hearing():
    df = frame([("2016-01-01", "2016-01-11", 20, True), ("2016-01-01", "2016-01-11", 500, False),
                ("2016-01-01", "2016-01-11", 500, False)])
    # one of three ended, so half the cases never ended within the data: no median
    assert stage_summary(stage_days(df))["median_after_first_hearing"] is None


def open_cases():
    return pd.DataFrame({
        "ended": [False, False, True, False], "group": ["missing", "missing", "decided", "moved"],
        "purpose": [" Evidence", "evidence", "judgement", "evidence"],
        "date_last_list": pd.to_datetime(["2018-01-01"] * 4),
        "date_next_list": pd.to_datetime(["2018-02-01", "2018-01-11", "2018-02-01", "2018-02-01"]),
    })


def test_gap_and_stage_use_only_cases_still_open():
    assert sorted(hearing_gap(open_cases()).tolist()) == [10, 31]
    assert stuck_at(open_cases()) == [{"purpose": "evidence", "share": 1.0}]
    assert np.isclose(sum(s["share"] for s in stuck_at(open_cases())), 1.0)
