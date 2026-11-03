import numpy as np
import pandas as pd
import pytest

from tareekh.target import label, within

CUTOFF = pd.Timestamp("2019-02-28")


def case(filed="2015-01-01", decided=None, disp="convicted", impossible=False):
    filed = pd.Timestamp(filed)
    decided = pd.Timestamp(decided) if decided else pd.NaT
    return {"date_of_filing": filed, "date_of_decision": decided, "disp": disp,
            "decided_before_filing": bool(pd.notna(decided) and decided < filed),
            "date_of_decision_impossible": impossible}


def run(*cases, cutoff=CUTOFF):
    df = pd.DataFrame(list(cases))
    return label(df, pd.Series(cutoff, index=df.index))


def test_a_decided_case_ends_on_its_decision_date():
    row = run(case(decided="2016-01-01")).iloc[0]
    assert row.ended and row.observed_days == 365 and row.unusable == ""


def test_a_pending_case_is_watched_until_the_cutoff():
    row = run(case(disp="disposition var missing")).iloc[0]
    assert not row.ended and row.observed_days == (CUTOFF - pd.Timestamp("2015-01-01")).days


def test_a_decision_after_the_cutoff_is_not_an_ending():
    row = run(case(decided="2020-06-01")).iloc[0]
    assert not row.ended and row.observed_days == (CUTOFF - pd.Timestamp("2015-01-01")).days


def test_a_transfer_is_censored_at_the_transfer_date():
    row = run(case(decided="2015-07-01", disp="transferred")).iloc[0]
    assert not row.ended and row.observed_days == 181


def test_a_decision_date_without_a_disposition_counts_as_ended():
    row = run(case(decided="2016-01-01", disp="disposition var missing")).iloc[0]
    assert row.ended


@pytest.mark.parametrize("kwargs, reason", [
    ({"filed": "2019-06-01"}, "filed after the cutoff"),
    ({"decided": "2014-01-01"}, "decided before filing"),
    ({"impossible": True}, "impossible decision date"),
    ({"decided": "2015-02-01", "disp": "bail granted"}, "bail or interim order"),
])
def test_unusable_cases_say_why(kwargs, reason):
    row = run(case(**kwargs)).iloc[0]
    assert row.unusable == reason and np.isnan(row.observed_days) and not row.ended


def test_no_cutoff_means_unusable():
    row = run(case(decided="2016-01-01"), cutoff=pd.NaT).iloc[0]
    assert row.unusable == "no cutoff for this court"


def test_within_a_year_is_yes_no_or_unknown():
    df = run(
        case(decided="2015-06-01"),                            # ended in 151 days -> 1
        case(decided="2017-01-01"),                            # ended after 2 years -> 0
        case(filed="2010-01-01", disp="disposition var missing"),  # open 9 years -> 0
        case(filed="2018-09-01", disp="disposition var missing"),  # watched 180 days -> ?
        case(decided="2015-03-01", disp="transferred"),        # left after 59 days -> ?
        case(decided="2015-08-01", filed="2014-01-01", disp="transferred"),  # open >1y -> 0
    )
    assert within(df, 365).tolist()[:3] == [1.0, 0.0, 0.0]
    assert np.isnan(within(df, 365).iloc[3]) and np.isnan(within(df, 365).iloc[4])
    assert within(df, 365).iloc[5] == 0.0
