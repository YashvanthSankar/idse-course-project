"""Career Mode's fairness contract: at every company, every fraudster in every case type can be
caught by a tool that fits the fraud, and honest people stay out of it."""

from collections import Counter

import numpy as np
import pytest

from auditor.career.cases import CasePlan, build_career_case, plan_contract
from auditor.career.catalog import COMPANIES, TIER_SPECS
from auditor.career.people import company_people
from auditor.tools.registry import run_tool

CONTRACTS = range(20)
CATCH_PARAMS = {("under_limit", "groupby"): {"by": "vendor"}}


def _people(company_id: str):
    final = COMPANIES[company_id].tier == "final"
    return company_people(company_id, ["imran", "tara", "meher"] if final else ["tara"])


def _caught(df, culprit) -> bool:
    """Does at least one of the fraud's catching tools point at them (and at most one other)?"""
    for tool in culprit.catching_tools:
        analysis, _, _ = run_tool(tool, df, CATCH_PARAMS.get((culprit.scheme, tool), {}))
        if culprit.fraudster_id in analysis.implicates and len(analysis.implicates) <= 2:
            return True
    return False


@pytest.mark.slow
@pytest.mark.parametrize("company_id", list(COMPANIES))
def test_every_fraudster_is_catchable(company_id):
    company = COMPANIES[company_id]
    people = _people(company_id)
    hits, misses = Counter(), Counter()
    for contract in CONTRACTS:
        plans = plan_contract(company, np.random.default_rng(contract), {}, "tara")
        for plan in plans:
            bundle, _ = build_career_case(plan, people, "TEST", "c", len(plans))
            for culprit in bundle.truth.culprits():
                (hits if _caught(bundle.df, culprit) else misses)[culprit.scheme] += 1
    total = sum(hits.values()) + sum(misses.values())
    assert sum(hits.values()) >= 0.95 * total, f"{company_id}: missed {dict(misses)}"
    for scheme in misses:
        assert hits[scheme] >= 0.85 * (hits[scheme] + misses[scheme]), (
            f"{company_id}: {scheme} caught only {hits[scheme]}/{hits[scheme] + misses[scheme]}")


# Z-Score raises false alarms, and more of them as ledgers grow: that's the lesson that an
# outlier is a question, not an answer. Bounded so it stays useful; every other tool is quiet.
FALSE_ALARMS = {"zscore": 7}


@pytest.mark.slow
@pytest.mark.parametrize("company_id", list(COMPANIES))
def test_honest_companies_stay_quiet(company_id):
    company = COMPANIES[company_id]
    people = _people(company_id)
    noisy = Counter()
    for seed in CONTRACTS:
        plan = CasePlan(company_id, 4, "hard", (), company.herrings, seed)
        bundle, lineup = build_career_case(plan, people, "TEST", "c", 5)
        boss = {s.id for s, p in zip(bundle.meta.suspects, lineup) if p.is_head}  # the herring
        for tool in TIER_SPECS[company.tier].tools:
            if set(run_tool(tool, bundle.df, {})[0].implicates) - boss:
                noisy[tool] += 1
    loud = {tool: n for tool, n in noisy.items() if n > FALSE_ALARMS.get(tool, 2)}
    assert not loud, f"{company_id}: honest people accused by {loud} (out of 20 companies)"
