import numpy as np
import pandas as pd

from courtcases.cases import decode
from courtcases.cutoff import cliff, cutoffs, with_fallback


def write_keys(tmp_path):
    pd.DataFrame({"year": ["2010", "2010"], "type_name": ["1", "2"],
                  "type_name_s": ["cc", "o.s."], "count": [1, 1]}).to_csv(
        tmp_path / "type_name_key.csv", index=False)
    pd.DataFrame({"year": ["2010", "2011"], "purpose_name": ["7", "7"],
                  "purpose_name_s": ["evidence", "arguments"], "count": [1, 1]}).to_csv(
        tmp_path / "purpose_name_key.csv", index=False)
    pd.DataFrame({"year": ["2010", "2010"], "disp_name": ["42", "3"],
                  "disp_name_s": ["disposition var missing", "acquitted"], "count": [1, 1]}
                 ).to_csv(tmp_path / "disp_name_key.csv", index=False)
    return tmp_path


def raw(**cols):
    base = {"year": "2010", "state_code": "33", "type_name": "1", "purpose_name": "7",
            "disp_name": "3", "female_defendant": "0 male", "female_petitioner": "1 female",
            "female_adv_def": "-9999", "female_adv_pet": "0", "date_of_filing": "2010-03-01",
            "date_of_decision": "2011-03-01", "date_first_list": "", "date_last_list": "",
            "date_next_list": ""}
    base.update(cols)
    return pd.DataFrame([base])


def test_codes_are_decoded_per_year(tmp_path):
    keys = write_keys(tmp_path)
    df = pd.concat([raw(), raw(year="2011")], ignore_index=True)
    out = decode(df, keys)
    assert out["purpose"].tolist() == ["evidence", "arguments"]  # same code, different year
    assert out.loc[0, "type"] == "cc" and out.loc[0, "disp"] == "acquitted"


def test_gender_sentinels_become_categories(tmp_path):
    out = decode(raw(female_defendant="-9998 unclear", female_petitioner="-9999 missing name"),
                 write_keys(tmp_path))
    assert out.loc[0, "defendant"] == "unclear" and out.loc[0, "petitioner"] == "missing"
    assert out.loc[0, "adv_def"] == "missing" and out.loc[0, "adv_pet"] == "male"


def test_impossible_dates_are_blanked_and_flagged(tmp_path):
    out = decode(raw(date_of_decision="7201-10-15", date_last_list="5000-01-01"),
                 write_keys(tmp_path))
    assert pd.isna(out.loc[0, "date_of_decision"]) and out.loc[0, "date_of_decision_impossible"]
    assert pd.isna(out.loc[0, "date_last_list"]) and out.loc[0, "date_last_list_impossible"]
    assert pd.isna(out.loc[0, "days_to_decision"])


def test_decision_before_filing_is_flagged_not_a_negative_duration(tmp_path):
    out = decode(raw(date_of_decision="2009-01-01"), write_keys(tmp_path))
    assert out.loc[0, "decided_before_filing"]
    assert pd.isna(out.loc[0, "days_to_decision"])
    ok = decode(raw(), write_keys(tmp_path))
    assert ok.loc[0, "days_to_decision"] == 365 and not ok.loc[0, "decided_before_filing"]


def steady_then_scraped(scrape="2019-02", per_month=300, after=10, start="2014-01",
                        end="2020-06", seed=0):
    rng = np.random.default_rng(seed)
    dates = []
    for month in pd.period_range(start, end, freq="M"):
        n = per_month if month <= pd.Period(scrape) else after
        days = rng.integers(0, month.days_in_month, size=n)
        dates.extend(month.start_time + pd.to_timedelta(days, unit="D"))
    return pd.Series(pd.to_datetime(dates))


def test_cliff_is_the_end_of_the_last_full_month():
    assert cliff(steady_then_scraped("2019-02")) == pd.Timestamp("2019-02-28")


def test_the_low_trickle_after_a_scrape_does_not_drag_the_cliff_later():
    # two years of ~10 a month after the scrape must not become "the new normal"
    assert cliff(steady_then_scraped("2019-02", end="2021-03")) == pd.Timestamp("2019-02-28")


def test_a_one_month_vacation_dip_is_not_a_scrape():
    dates = steady_then_scraped("2019-02")
    may = dates.dt.to_period("M") == pd.Period("2017-05")
    dates = dates[~may | (np.arange(len(dates)) % 10 == 0)]  # May 2017 at 10% of normal
    assert cliff(dates) == pd.Timestamp("2019-02-28")


def test_one_cohort_slowly_running_out_of_cases_is_not_a_scrape():
    # decisions for a single filing year shrink ~4% a month as its cases get decided
    rng = np.random.default_rng(1)
    dates = []
    for k, month in enumerate(pd.period_range("2010-06", "2019-02", freq="M")):
        n = int(400 * 0.96 ** k)
        dates.extend(month.start_time + pd.to_timedelta(rng.integers(0, 28, n), unit="D"))
    after = pd.period_range("2019-03", "2020-06", freq="M")
    dates.extend(m.start_time for m in after)  # one a month after the scrape
    out = cliff(pd.Series(pd.to_datetime(dates)), min_typical=5)
    assert out == pd.Timestamp("2019-02-28")


def test_a_few_late_decisions_do_not_move_the_cliff():
    dates = pd.concat([steady_then_scraped("2019-02"),
                       pd.Series(pd.to_datetime(["2021-11-29", "2022-08-14"]))])
    assert cliff(dates) == pd.Timestamp("2019-02-28")


def test_a_slow_court_has_no_reliable_cliff():
    assert cliff(steady_then_scraped(per_month=3, after=0)) is None


def test_cutoffs_per_group():
    a = pd.DataFrame({"state_code": "27", "date_of_decision": steady_then_scraped("2019-02")})
    b = pd.DataFrame({"state_code": "09", "date_of_decision": steady_then_scraped("2020-02")})
    out = cutoffs(pd.concat([a, b]), by="state_code")
    assert out["27"] == pd.Timestamp("2019-02-28") and out["09"] == pd.Timestamp("2020-02-29")


def test_a_district_far_from_its_state_falls_back_to_the_state():
    local = pd.Series({("10", "01"): pd.Timestamp("2019-01-31"),
                       ("10", "02"): pd.Timestamp("2012-12-31"),  # a dip, not a scrape
                       ("10", "03"): pd.NaT})
    state = pd.Series({"10": pd.Timestamp("2019-01-31")})
    out = with_fallback(local, state, parent_of=lambda key: key[0])
    assert (out == pd.Timestamp("2019-01-31")).all()
