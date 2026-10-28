from collections import Counter
from typing import get_args

import numpy as np

from auditor.adapt import pick_scheme
from auditor.models import SchemeId


def test_adapt_avoids_top_tools():
    profile = Counter({"zscore": 9, "iqr_box": 7, "benford": 1})
    picks = {pick_scheme(profile, np.random.default_rng(s)) for s in range(50)}
    assert "big_invoice" not in picks
    assert len(picks) > 1


def test_adapt_avoids_benford_lover():
    profile = Counter({"benford": 12, "duplicates": 5})
    for s in range(30):
        assert pick_scheme(profile, np.random.default_rng(s)) not in {"fabricated", "duplicates"}


def test_adapt_falls_back_when_everything_known():
    profile = Counter({t: 3 for t in ["zscore", "iqr_box", "duplicates", "benford", "timeseries",
                                      "regression", "isoforest", "groupby"]})
    assert pick_scheme(profile, np.random.default_rng(0)) in get_args(SchemeId)


def test_adapt_new_player_gets_any_scheme():
    assert pick_scheme(Counter(), np.random.default_rng(3)) in get_args(SchemeId)
