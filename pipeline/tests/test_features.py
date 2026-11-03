import numpy as np
import pandas as pd

from tareekh.features import congestion, prev_year_load


def cases(rows):
    df = pd.DataFrame(rows, columns=["date_of_filing", "observed_days", "ended", "group"])
    df["date_of_filing"] = pd.to_datetime(df["date_of_filing"])
    df["court"] = "A"
    return df


def test_pending_counts_only_earlier_cases_still_open_on_the_filing_day():
    df = cases([
        ("2016-01-01", 100, True, "decided"),     # ends 2016-04-10
        ("2016-02-01", 400, False, "missing"),    # still open at the cutoff
        ("2016-03-01", 10, False, "moved"),       # moved away 2016-03-11
        ("2016-06-01", 30, True, "decided"),
    ])
    out = congestion(df, ["court"])
    assert out["pending_at_filing"].tolist() == [0, 1, 2, 1]
    # by 2016-06-01: the first case ended and the third moved within the past year
    assert out.loc[3, "disposed_last_year"] == 2
    assert np.isclose(out.loc[3, "clearance_last_year"], 2 / 2)


def test_groups_do_not_mix():
    df = pd.concat([cases([("2016-01-01", 500, False, "missing")]).assign(court="A"),
                    cases([("2016-05-01", 10, True, "decided")]).assign(court="B")],
                   ignore_index=True)
    assert congestion(df, ["court"])["pending_at_filing"].tolist() == [0, 0]


def test_prev_year_load_uses_last_year_only():
    df = pd.DataFrame({"dist_code": ["01"] * 4, "type": ["os"] * 4,
                       "filing_year": [2015, 2015, 2016, 2017]})
    assert prev_year_load(df).tolist() == [0, 0, 2, 1]
