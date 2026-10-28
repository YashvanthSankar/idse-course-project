"""Brain mode: budgets are tight, so every run is a decision — but every case stays winnable."""

import pytest

from auditor.generator.cases import LEVELS
from auditor.generator.schemes import SCHEME_CATCHERS
from auditor.tools.registry import TOOLS


@pytest.mark.parametrize("level", range(1, 7))
def test_every_case_is_doable_on_its_budget(level):
    spec = LEVELS[level]
    catcher = min(TOOLS[t].cost for t in SCHEME_CATCHERS[spec.scheme])
    # the weekend case needs the Timeline twice (daily + weekly) for two strong clues
    second = catcher if spec.scheme == "weekend" else 1
    assert catcher + second <= spec.budget


@pytest.mark.parametrize("level", range(1, 7))
def test_no_case_lets_you_run_everything(level):
    spec = LEVELS[level]
    unlocked = [t for t in TOOLS.values() if t.unlock_level <= level]
    assert sum(t.cost for t in unlocked) > spec.budget  # you must choose
