import numpy as np
import pandas as pd

from courtcases.features import congestion, prev_year_load


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


def test_law_features_join_by_case_id_and_mark_missing_rows():
    from courtcases.features import NO_LAW, add_law, decode_acts

    acts = pd.DataFrame({"ddl_case_id": ["10-a", "10-b"], "act": ["1", "2"],
                         "section": ["7", "8"], "bailable_ipc": ["non-bailable", ""],
                         "number_sections_ipc": ["3", ""], "criminal": ["1", "0"]})
    act_key = pd.DataFrame({"act": ["1", "2"], "act_s": ["The Indian Penal Code",
                                                         "NEGOTIABLE INSTRUMENTS ACT"]})
    section_key = pd.DataFrame({"section": ["7", "8"], "section_s": ["302", "138NIAct"]})
    decoded = decode_acts(acts, act_key, section_key)
    assert decoded["law"].tolist() == ["Indian Penal Code", "Negotiable Instruments Act"]
    assert decoded["section"].tolist() == ["302", "138"]
    labelled = pd.DataFrame({"ddl_case_id": ["10-b", "10-a", "10-z"]}, index=[5, 6, 7])
    frame = pd.DataFrame(index=labelled.index)
    out = add_law(frame, labelled, decoded, vocabulary=["Indian Penal Code s.302"])
    assert out["law_section"].tolist() == ["Negotiable Instruments Act (other section)",
                                           "Indian Penal Code s.302", f"{NO_LAW} (other section)"]
    assert out.loc[6, "ipc_bailable"] == "non-bailable" and out.loc[6, "n_ipc_sections"] == 3
    assert out.loc[7, "law"] == NO_LAW and out.loc[5, "criminal"] == "civil"
