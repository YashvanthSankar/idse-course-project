import numpy as np
import pandas as pd

from courtcases.clusters import choose_and_fit
from courtcases.survival import kaplan_meier, median_days, still_open_at


def test_kaplan_meier_matches_the_hand_calculation():
    # durations 1,2,2,3,4; the second "2" and the "4" were still open when watching stopped
    curve = kaplan_meier([1, 2, 2, 3, 4], [True, True, False, True, False])
    assert curve["days"].tolist() == [1, 2, 3]
    assert curve["at_risk"].tolist() == [5, 4, 2]
    # S(1) = 4/5; S(2) = 0.8 * 3/4; S(3) = 0.6 * 1/2
    assert np.allclose(curve["still_open"], [0.8, 0.6, 0.3])
    assert np.allclose(still_open_at(curve, [0, 1, 2.5, 10]), [1.0, 0.8, 0.6, 0.3])
    assert median_days(curve) == 3


def test_censored_cases_are_not_counted_as_finished():
    # dropping still-open cases would say "everything ends by day 10"; KM says half stay open
    curve = kaplan_meier([10, 10, 100, 100], [True, True, False, False])
    assert still_open_at(curve, [50])[0] == 0.5
    assert median_days(curve) == 10


def test_never_reaching_half_has_no_median_and_nans_are_ignored():
    curve = kaplan_meier([5, np.nan, 50, 60], [True, True, False, False])
    assert median_days(curve) is None
    assert curve["at_risk"].iloc[0] == 3


def test_kmeans_finds_planted_groups_and_numbers_them_fastest_first():
    rng = np.random.default_rng(0)
    fast = rng.normal(0.8, 0.02, size=(6, 3))
    slow = rng.normal(0.2, 0.02, size=(6, 3))
    profile = pd.DataFrame(np.vstack([slow, fast]), columns=["os", "cc", "stc"],
                           index=[f"d{i}" for i in range(12)])
    result = choose_and_fit(profile, ks=range(2, 5))
    assert result.k == 2
    assert set(result.labels[[f"d{i}" for i in range(6, 12)]]) == {0}  # fast group is 0
    assert set(result.labels[[f"d{i}" for i in range(6)]]) == {1}
    assert result.centres.loc[0].mean() > result.centres.loc[1].mean()
    assert set(result.silhouette) == {2, 3, 4}


def test_a_district_missing_one_measure_is_kept_with_the_median():
    profile = pd.DataFrame({"os": [0.1, 0.2, 0.8, 0.9, 0.15], "cc": [0.1, 0.2, 0.8, 0.9, None]},
                           index=["a", "b", "c", "d", "chennai"])
    result = choose_and_fit(profile, ks=range(2, 3))
    assert "chennai" in result.labels.index
    assert result.imputed == {"chennai": ["cc"]}
