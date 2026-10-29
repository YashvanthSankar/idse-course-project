"""Career cases: the same ledger generator as Quick Case, shaped by the company — its people,
its culture, its frauds — and by where the case sits in the contract (CAREER.md §2.1)."""

from collections import Counter
from dataclasses import dataclass

import numpy as np
import pandas as pd

from auditor.adapt import pick_scheme
from auditor.career.catalog import COMPANIES, TIER_SPECS, Company, Difficulty
from auditor.career.people import Person
from auditor.generator.base import make_honest_transactions
from auditor.generator.cases import CASE_START, CaseBundle
from auditor.generator.red_herrings import add_herring
from auditor.generator.schemes import SCHEME_CATCHERS, SCHEME_EXPLANATIONS, inject
from auditor.models import (
    CareerCaseInfo,
    CaseMeta,
    CaseTruth,
    Culprit,
    HerringId,
    SchemeId,
    Suspect,
    ToolId,
)
from auditor.tools.registry import TOOLS

# The method each fraud teaches — the yardstick for efficiency (CAREER.md §3.1). When the
# first choice isn't unlocked yet, the next one is.
INTENDED: dict[SchemeId, list[ToolId]] = {
    "big_invoice": ["iqr_box"],
    "duplicates": ["duplicates"],
    "fabricated": ["benford"],
    "weekend": ["timeseries"],
    "inflated_ratio": ["regression"],
    "under_limit": ["isoforest", "groupby"],
}
SPARE_COINS: dict[Difficulty, int] = {"easy": 4, "medium": 3, "hard": 2, "very_hard": 2}

CLEAR: dict[SchemeId, str] = {
    "big_invoice": "One of them slipped a monster invoice past the system. Compare each person "
                   "with their own normal — not with the boss.",
    "duplicates": "The same bill keeps coming back with a fresh invoice number. Line the "
                  "receipts up side by side.",
    "fabricated": "The amounts look clean. Too clean. Real money has a shape, kid: look at the "
                  "very first digit of every amount.",
    "weekend": "The office is shut on Saturdays and Sundays. Someone's company card isn't.",
    "inflated_ratio": "Bigger deals cost more to win, and that line is steady for most people. "
                      "Draw it and see who lives above it.",
    "under_limit": "A vendor nobody in the office has ever met keeps getting paid. Find out "
                   "who's paying them.",
}
HINT: dict[SchemeId, str] = {
    "big_invoice": "Something in these books is far too big for its kind.",
    "duplicates": "Some of these payments feel familiar. Too familiar.",
    "fabricated": "Every claim is the right size and on time, and still nobody believes them.",
    "weekend": "Somebody's been working hours nobody asked for.",
    "inflated_ratio": "For one of them, the costs have stopped following the deals.",
    "under_limit": "Money is leaving for somewhere nobody can name.",
}
VAGUE = ("The board can't say what's wrong at {company}. Only that something is. You've got "
         "the ledger and a budget. Find it.")
TWO = ("Two of them this time, working separately, each hiding from a different tool. "
       "Find both, and bring two clues for each.")
FINAL: list[str] = [
    ("The Commission's first file. Two people at Kaveri Holdings are moving money they "
     "shouldn't. Whoever trained them knows how you work."),
    ("Second file. Same building, different floor. They've adjusted: whatever caught the last "
     "pair won't be enough on its own."),
    ("The last file. Everyone you've ever worked with seems to have passed through Kaveri at "
     "some point. Check every number. Trust nobody's face."),
]
HERRING_NOTES: dict[HerringId, str] = {
    "ceo": "{head} spends big on everything. Big isn't the same as crooked.",
    "diwali": "Mind the Diwali bonus week: everyone got paid then. That's the festival, not a "
              "crime.",
}


@dataclass(frozen=True)
class CasePlan:
    """What a case will be, decided when the contract is signed (kept server-side)."""

    company_id: str
    index: int  # 0-based
    difficulty: Difficulty
    schemes: tuple[SchemeId, ...]
    herrings: tuple[HerringId, ...]
    seed: int
    forced_cameo: str | None = None  # the Final's last case: an old colleague did it


def plan_contract(company: Company, rng: np.random.Generator,
                  tool_counts: dict[str, int] | None = None,
                  final_culprit: str | None = None) -> list[CasePlan]:
    """Five cases (three in the Final), easiest first."""
    spec = TIER_SPECS[company.tier]
    others = [s for s in company.schemes if s != company.signature] or [company.signature]
    plans = []
    for i, difficulty in enumerate(spec.plan):
        seed = int(rng.integers(2**31))
        if company.tier == "final":
            # The Adaptive Fraudster: both schemes hide from the tools you lean on
            first = pick_scheme(Counter(tool_counts or {}), rng)
            rest = [s for s in company.schemes if s != first]
            second = rest[int(rng.integers(len(rest)))]
            schemes: tuple[SchemeId, ...] = (first, second)
        elif difficulty == "very_hard":
            pair = rng.choice(len(company.schemes), size=2, replace=False)
            schemes = tuple(company.schemes[int(j)] for j in pair)
        elif difficulty == "easy" or (difficulty == "medium" and i == 2):
            schemes = (company.signature,)
        else:
            schemes = (others[int(rng.integers(len(others)))],)
        herrings = () if difficulty == "easy" else (
            company.herrings[:1] if difficulty == "medium" else company.herrings)
        forced = final_culprit if company.tier == "final" and i == len(spec.plan) - 1 else None
        plans.append(CasePlan(company.id, i, difficulty, schemes, tuple(herrings), seed, forced))
    return plans


def _briefing(company: Company, plan: CasePlan, head: Person | None) -> str:
    if company.tier == "final":
        text = FINAL[min(plan.index, len(FINAL) - 1)]
    elif plan.difficulty == "very_hard":
        text = TWO
    elif plan.difficulty == "hard":
        text = VAGUE.format(company=company.name)
    elif plan.difficulty == "medium":
        text = HINT[plan.schemes[0]]
    else:
        text = CLEAR[plan.schemes[0]]
    notes = [HERRING_NOTES[h].format(head=head.name if head else "The boss")
             for h in plan.herrings if plan.difficulty in ("easy", "medium")]
    return " ".join([f"{company.name}.", text, *notes])


def _intended_cost(scheme: SchemeId, unlocked: list[ToolId]) -> int:
    tool = next(t for t in INTENDED[scheme] if t in unlocked)
    return TOOLS[tool].cost


def intended_cost(schemes: list[SchemeId], unlocked: list[ToolId]) -> int:
    return sum(_intended_cost(s, unlocked) for s in schemes)


def build_career_case(plan: CasePlan, people: list[Person], code: str, case_id: str,
                      total: int) -> tuple[CaseBundle, list[Person]]:
    """The case and its lineup (the people behind E1…En, in order)."""
    company = COMPANIES[plan.company_id]
    spec = TIER_SPECS[company.tier]
    rng = np.random.default_rng(plan.seed)

    head = next((p for p in people if p.is_head), None)
    pool = [p for p in people if not p.is_head]
    fixed: list[Person] = []
    if "ceo" in plan.herrings and head:
        fixed.append(head)
    if plan.forced_cameo:
        fixed.append(next(p for p in pool if p.cameo == plan.forced_cameo))
    rest = [p for p in pool if p not in fixed]
    picks = rng.choice(len(rest), size=spec.suspects - len(fixed), replace=False)
    lineup = fixed + [rest[int(i)] for i in picks]
    lineup = [lineup[int(i)] for i in rng.permutation(len(lineup))]
    suspects = [Suspect(id=f"E{i}", name=p.name, role=p.role, department=p.department,
                        bio=p.bio, portrait=p.portrait)
                for i, p in enumerate(lineup, start=1)]
    by_id = {s.id: p for s, p in zip(suspects, lineup)}

    df = make_honest_transactions(rng, suspects, spec.rows, CASE_START, culture=company.culture)
    for herring in plan.herrings:
        df = add_herring(herring, df, suspects, rng)

    # Cameos and the boss are never guilty — except the Final's last case, where one is.
    eligible = [s.id for s in suspects if not by_id[s.id].is_head and not by_id[s.id].cameo]
    fraudsters: list[str] = []
    if plan.forced_cameo:
        fraudsters.append(next(s.id for s in suspects if by_id[s.id].cameo == plan.forced_cameo))
    while len(fraudsters) < len(plan.schemes):
        choice = [e for e in eligible if e not in fraudsters]
        fraudsters.append(choice[int(rng.integers(len(choice)))])

    rows_each = spec.rows / spec.suspects
    scale = max(1.0, rows_each / 200)
    fraud: list[list[str]] = []
    for scheme, fraudster in zip(plan.schemes, fraudsters):
        df, ids = inject(scheme, df, fraudster, rng, scale=scale)
        fraud.append(ids)

    df = df.sort_values(["date", "hour"], kind="stable").reset_index(drop=True)
    mapping = {old: f"T{i:05d}" for i, old in enumerate(df["txn_id"], start=1)}
    df["txn_id"] = df["txn_id"].map(mapping)
    fraud = [sorted(mapping[t] for t in ids) for ids in fraud]

    unlocked = spec.tools

    def catchers(scheme: SchemeId) -> list[ToolId]:
        return [t for t in SCHEME_CATCHERS[scheme] if t in unlocked]

    if not plan.schemes:  # an honest company (fairness tests)
        truth = CaseTruth(fraudster_id=None, scheme=None, fraud_txn_ids=[], catching_tools=[],
                          herrings=list(plan.herrings), explanation="Nobody did it.")
        return CaseBundle(meta=_meta(plan, company, head, suspects, df, code, case_id, total, 0),
                          df=df, truth=truth), lineup
    first, *second = list(zip(plan.schemes, fraudsters, fraud))
    truth = CaseTruth(
        fraudster_id=first[1], scheme=first[0], fraud_txn_ids=first[2],
        catching_tools=catchers(first[0]), herrings=list(plan.herrings),
        explanation=SCHEME_EXPLANATIONS[first[0]],
        second=Culprit(fraudster_id=second[0][1], scheme=second[0][0],
                       fraud_txn_ids=second[0][2], catching_tools=catchers(second[0][0]),
                       explanation=SCHEME_EXPLANATIONS[second[0][0]]) if second else None,
    )
    budget = intended_cost(list(plan.schemes), unlocked) + SPARE_COINS[plan.difficulty]
    meta = _meta(plan, company, head, suspects, df, code, case_id, total, budget)
    return CaseBundle(meta=meta, df=df, truth=truth), lineup


def _meta(plan: CasePlan, company: Company, head: Person | None, suspects: list[Suspect],
          df: pd.DataFrame, code: str, case_id: str, total: int, budget: int) -> CaseMeta:
    spec = TIER_SPECS[company.tier]
    return CaseMeta(
        case_id=case_id,
        level=spec.tool_level,
        title=f"{company.name} · Case {plan.index + 1}",
        briefing=_briefing(company, plan, head) if plan.schemes else "",
        budget=budget,
        budget_left=budget,
        suspects=suspects,
        columns=list(df.columns),
        n_rows=len(df),
        unlocked_tools=spec.tools,
        career=CareerCaseInfo(code=code, company_id=company.id, company=company.name,
                              index=plan.index + 1, total=total, difficulty=plan.difficulty,
                              culprits=len(plan.schemes)),
    )
