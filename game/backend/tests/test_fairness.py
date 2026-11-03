"""The game's fairness contract (DESIGN.md §5): every case is solvable, honesty stays quiet."""

import pytest

from auditor.generator.cases import LEVELS, build_case, build_honest_case
from auditor.generator.schemes import SCHEME_CATCHERS
from auditor.tools.registry import TOOLS, run_tool

SEEDS = range(20)
# The params a sensible detective would use for each catching tool on each scheme
CATCH_PARAMS = {
    ("big_invoice", "zscore"): {"scope": "per_employee"},
    ("weekend", "groupby"): {"by": "weekday"},
    ("under_limit", "groupby"): {"by": "vendor"},
}
CASES = [
    (level, tool)
    for level in range(1, 7)
    for tool in SCHEME_CATCHERS[LEVELS[level].scheme]
]


@pytest.mark.slow
@pytest.mark.parametrize(("level", "tool"), CASES)
def test_P1_catching_tools_find_fraudster(level, tool):
    hits = 0
    for seed in SEEDS:
        case = build_case(level, seed)
        params = CATCH_PARAMS.get((case.truth.scheme, tool), {})
        analysis, _, _ = run_tool(tool, case.df, params)
        hits += case.truth.fraudster_id in analysis.implicates and len(analysis.implicates) <= 2
    assert hits >= 19, f"{tool} caught the level {level} fraudster in only {hits}/20 cases"


@pytest.mark.slow
@pytest.mark.parametrize("tool", list(TOOLS))
def test_P2_honest_cases_are_quiet(tool):
    quiet = sum(run_tool(tool, build_honest_case(seed).df, {})[0].implicates == []
                for seed in SEEDS)
    assert quiet >= 18, f"{tool} accused honest people in {20 - quiet}/20 honest companies"
