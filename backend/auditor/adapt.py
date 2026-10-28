"""The Adaptive Fraudster: it studies which tools you lean on and hides from them."""

from collections import Counter
from typing import get_args

import numpy as np

from auditor.generator.schemes import SCHEME_CATCHERS
from auditor.models import SchemeId

ALL_SCHEMES: list[SchemeId] = list(get_args(SchemeId))


def pick_scheme(profile: Counter[str], rng: np.random.Generator) -> SchemeId:
    favourites = {tool for tool, _ in profile.most_common(2)}
    unseen = [s for s in ALL_SCHEMES if not favourites & set(SCHEME_CATCHERS[s])]
    pool = unseen or ALL_SCHEMES
    return pool[int(rng.integers(len(pool)))]
