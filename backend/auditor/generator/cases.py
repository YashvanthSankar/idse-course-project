"""The case catalog: seven levels, each built deterministically from a seed."""

from dataclasses import dataclass
from datetime import date
from typing import get_args

import numpy as np
import pandas as pd

from auditor.generator.base import make_honest_transactions, make_suspects
from auditor.generator.red_herrings import add_herring
from auditor.generator.schemes import SCHEME_CATCHERS, SCHEME_EXPLANATIONS, inject
from auditor.models import CaseMeta, CaseTruth, HerringId, LevelInfo, SchemeId, ToolId

CASE_START = date(2026, 8, 17)  # 90-day window ending mid-November: Diwali falls inside
TOOL_ORDER: list[ToolId] = list(get_args(ToolId))
ALL_SCHEMES: list[SchemeId] = list(get_args(SchemeId))

COMPANIES = [
    "Sterling Mercantile Pvt. Ltd.",
    "Konkan Freight & Logistics",
    "Bluewave Pharma Distributors",
    "Arabian Sea Shipping Co.",
    "Malabar Textiles International",
    "Horizon Realty Developers",
    "Saffron Media Networks",
]


@dataclass(frozen=True)
class LevelSpec:
    level: int
    title: str
    teaser: str
    briefing: str
    scheme: SchemeId | None
    budget: int
    herrings: tuple[HerringId, ...]
    unlocks: tuple[ToolId, ...]
    difficulty: int


LEVELS: dict[int, LevelSpec] = {
    1: LevelSpec(
        1, "The Midnight Invoice",
        "One claim at {company} is far too large for its kind.",
        "Rookie. {company}'s internal audit flagged something, then went home. One of these "
        "five has slipped a monster invoice past the system. Careful — the boss spends big "
        "on everything, and big isn't the same as crooked. Compare people with themselves.",
        "big_invoice", 5, ("ceo",), ("summary", "groupby", "zscore", "iqr_box"), 1,
    ),
    2: LevelSpec(
        2, "Déjà Vu",
        "Some dinners at {company} were paid for twice.",
        "{company} paid the same restaurant twice for the same night — more than once. "
        "Somebody's been recycling receipts with fresh invoice numbers. Line them up.",
        "duplicates", 5, (), ("duplicates",), 2,
    ),
    3: LevelSpec(
        3, "Too Random To Be True",
        "The numbers at {company} look clean. Too clean.",
        "Every claim at {company} is the right size, filed on time, signed off. And yet "
        "the numbers feel… made up. Real money has a shape, kid. Look at the very first "
        "digit of every amount.",
        "fabricated", 6, (), ("benford",), 2,
    ),
    4: LevelSpec(
        4, "Weekend Warrior",
        "{company}'s card keeps working while the office sleeps.",
        "{company} closes on Saturdays and Sundays. Someone's company card doesn't. Mind "
        "the Diwali bonus week — everyone got paid then, that's the festival, not a crime.",
        "weekend", 7, ("diwali",), ("timeseries",), 3,
    ),
    5: LevelSpec(
        5, "The Margin Call",
        "Expenses at {company} have stopped tracking the deals.",
        "Every expense at {company} serves a deal, and bigger deals cost more to win. That "
        "relationship is steady — for most people. Draw the honest line and see who lives "
        "above it.",
        "inflated_ratio", 7, (), ("regression",), 3,
    ),
    6: LevelSpec(
        6, "Ghost Vendor",
        "A vendor at {company} that nobody has ever met.",
        "Big payments at {company}, odd hours, a vendor name nobody in the office "
        "recognises. Each clue alone is nothing. Together they're a ghost. Let the machine "
        "find what doesn't belong — and don't get distracted by the CEO or the Diwali bonuses.",
        "under_limit", 9, ("ceo", "diwali"), ("isoforest",), 4,
    ),
    7: LevelSpec(
        7, "The Adaptive Fraudster",
        "Endless mode: the fraudster has studied your methods.",
        "Word on the street is they've been watching how you work, rookie. Whatever trick "
        "you lean on, they've learned to hide from it. Use the whole kit.",
        None, 10, (), (), 5,
    ),
}


@dataclass
class CaseBundle:
    meta: CaseMeta
    df: pd.DataFrame
    truth: CaseTruth



def _sentence(text: str) -> str:
    """"the firm's card…" opens a teaser: capitalise it."""
    return text[:1].upper() + text[1:]

def unlocked_until(level: int) -> list[ToolId]:
    unlocked = {t for lv, spec in LEVELS.items() if lv <= level for t in spec.unlocks}
    return [t for t in TOOL_ORDER if t in unlocked]


def level_infos() -> list[LevelInfo]:
    return [
        LevelInfo(level=s.level, title=s.title, teaser=_sentence(s.teaser.format(company="the firm")),
                  budget=s.budget, difficulty=s.difficulty)
        for s in LEVELS.values()
    ]


def _finalise(df: pd.DataFrame, fraud_ids: list[str]) -> tuple[pd.DataFrame, list[str]]:
    """Sort chronologically and renumber txn ids, remapping the fraud ids."""
    df = df.sort_values(["date", "hour"], kind="stable").reset_index(drop=True)
    mapping = {old: f"T{i:05d}" for i, old in enumerate(df["txn_id"], start=1)}
    df["txn_id"] = df["txn_id"].map(mapping)
    return df, sorted(mapping[t] for t in fraud_ids)


def build_case(
    level: int,
    seed: int,
    scheme_override: SchemeId | None = None,
    case_id: str | None = None,
) -> CaseBundle:
    spec = LEVELS[level]
    rng = np.random.default_rng(seed)
    company = str(rng.choice(COMPANIES))

    herrings: tuple[HerringId, ...] = spec.herrings
    if level == 7:
        herrings = tuple(h for h in ("ceo", "diwali") if rng.random() < 0.5)

    suspects = make_suspects(rng, include_ceo="ceo" in herrings)
    df = make_honest_transactions(rng, suspects, int(rng.integers(900, 1200)), CASE_START)
    for herring in herrings:
        df = add_herring(herring, df, suspects, rng)

    scheme: SchemeId = scheme_override or spec.scheme or ALL_SCHEMES[rng.integers(6)]
    fraudster = str(rng.choice([s.id for s in suspects if s.role != "CEO"]))
    df, fraud_ids = inject(scheme, df, fraudster, rng)
    df, fraud_ids = _finalise(df, fraud_ids)

    truth = CaseTruth(
        fraudster_id=fraudster,
        scheme=scheme,
        fraud_txn_ids=fraud_ids,
        catching_tools=SCHEME_CATCHERS[scheme],
        herrings=list(herrings),
        explanation=SCHEME_EXPLANATIONS[scheme],
    )
    meta = CaseMeta(
        case_id=case_id or f"L{level}-S{seed}",
        level=level,
        title=spec.title,
        briefing=spec.briefing.format(company=company),
        budget=spec.budget,
        budget_left=spec.budget,
        suspects=suspects,
        columns=list(df.columns),
        n_rows=len(df),
        unlocked_tools=unlocked_until(level),
    )
    return CaseBundle(meta=meta, df=df, truth=truth)


def build_honest_case(seed: int) -> CaseBundle:
    """A case with no fraud at all (but with both red herrings) — for fairness tests."""
    rng = np.random.default_rng(seed)
    suspects = make_suspects(rng, include_ceo=True)
    df = make_honest_transactions(rng, suspects, int(rng.integers(900, 1200)), CASE_START)
    for herring in ("ceo", "diwali"):
        df = add_herring(herring, df, suspects, rng)
    df, _ = _finalise(df, [])
    truth = CaseTruth(fraudster_id=None, scheme=None, fraud_txn_ids=[], catching_tools=[],
                      herrings=["ceo", "diwali"], explanation="Nobody did it. This time.")
    meta = CaseMeta(
        case_id=f"H-S{seed}", level=7, title="An Honest Company", briefing="", budget=99,
        budget_left=99, suspects=suspects, columns=list(df.columns), n_rows=len(df),
        unlocked_tools=unlocked_until(7),
    )
    return CaseBundle(meta=meta, df=df, truth=truth)
