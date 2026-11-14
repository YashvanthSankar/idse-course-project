import numpy as np
import pandas as pd

from courtcases.settlement import ended_as, lookup_rates, top_decile_precision


def frame():
    filed = pd.Timestamp("2015-01-01")
    return pd.DataFrame({
        "group": ["settled", "dismissed", "settled", "missing", "settled"],
        "observed_days": [100.0, 200.0, 900.0, 800.0, 100.0],
        "ended": [True, True, True, False, True],
        "unusable": ["", "", "", "", ""],
        "date_of_filing": [filed] * 4 + [pd.Timestamp("2018-06-01")],
        "cutoff": [pd.Timestamp("2019-01-01")] * 5,
    })


def test_only_endings_of_that_kind_inside_the_horizon_count():
    y = ended_as(frame(), "settled", 730)
    assert y.iloc[0] == 1  # settled at day 100
    assert y.iloc[1] == 0  # ended, but dismissed
    assert y.iloc[2] == 0  # settled, but after the horizon
    assert y.iloc[3] == 0  # still open after the horizon


def test_a_case_without_full_follow_up_has_no_label():
    assert np.isnan(ended_as(frame(), "settled", 730).iloc[4])


def test_lookup_shrinks_towards_the_overall_rate_and_handles_unseen_groups():
    train = pd.DataFrame({"k": ["a", "a", "b", "b"], "y": [1, 1, 0, 0]})
    test = pd.DataFrame({"k": ["a", "z"]})
    rates = lookup_rates(train, test, ["k"], "y", prior_weight=2)
    assert rates[0] == (2 + 2 * 0.5) / (2 + 2)
    assert rates[1] == 0.5


def test_top_decile_precision_reads_the_highest_scores():
    y = np.array([1] + [0] * 9)
    assert top_decile_precision(y, np.linspace(1, 0, 10)) == 1.0
    assert top_decile_precision(y, np.linspace(0, 1, 10)) == 0.0
