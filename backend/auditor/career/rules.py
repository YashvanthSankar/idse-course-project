"""A career's state and every rule that moves it (CAREER.md §1, §4, §5, §7.6)."""

import hashlib
import time
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field

from auditor.career.cases import plan_contract
from auditor.career.catalog import (
    CAMEOS,
    COMPANIES,
    TIER_NAMES,
    TIER_SPECS,
    TIERS,
    Band,
    Difficulty,
    Tier,
    companies_in,
)
from auditor.career.people import cameo_person
from auditor.career.rating import CaseRating, contract_band
from auditor.models import HerringId, SchemeId

CHIEF_AUDITOR = "Chief Auditor"


class CaseRecord(BaseModel):
    index: int
    difficulty: Difficulty
    seed: int
    schemes: list[SchemeId]
    herrings: list[HerringId]
    forced_cameo: str | None = None
    case_id: str | None = None
    lineup_cameos: list[str] = Field(default_factory=list)
    rating: CaseRating | None = None
    correct: bool | None = None  # every culprit caught
    caught_cameo: bool | None = None  # the Final's last case


class Greeting(BaseModel):
    cameo: str
    name: str
    portrait: str
    role: str
    line: str
    last_company: str | None  # where you last worked together (None: you're just meeting)


class Contract(BaseModel):
    company_id: str
    year: int
    practice: bool = False
    cameos: list[str]
    greetings: list[Greeting]
    cases: list[CaseRecord]


class Appraisal(BaseModel):
    company_id: str
    company: str
    tier: Tier
    year: int
    practice: bool
    ratings: list[float]
    average: float
    band: Band
    salary_before: float
    salary_after: float
    events: list[str]
    new_offers: list[str]


class CompanyRecord(BaseModel):
    contracts: int = 0
    bad_streak: int = 0
    banned: bool = False


class TrailStop(BaseModel):
    """One company where you worked alongside an old colleague (for the Final's cutscene)."""

    company_id: str
    company: str
    year: int
    role: str
    line: str
    lineups: int  # cases where they stood in your lineup


class Career(BaseModel):
    code: str
    player_id: str | None = None
    created: float
    status: Literal["offers", "contract", "ended", "retired"] = "offers"
    year: int = 1
    tier: Tier = "small"
    salary: float = TIER_SPECS["small"].base
    title: str | None = None
    offers: list[str]
    contract: Contract | None = None
    history: list[Appraisal] = Field(default_factory=list)
    companies: dict[str, CompanyRecord] = Field(default_factory=dict)
    mid_good: list[str] = Field(default_factory=list)
    large_exceptional: list[str] = Field(default_factory=list)
    vl_exceptional: list[str] = Field(default_factory=list)
    cameo_weights: dict[str, float] = Field(default_factory=lambda: {c: 1.0 for c in CAMEOS})
    cameo_last: dict[str, str] = Field(default_factory=dict)
    cameo_trail: dict[str, list[TrailStop]] = Field(default_factory=dict)
    final_culprit: str
    tool_counts: dict[str, int] = Field(default_factory=dict)
    ending: Literal["caught", "escaped"] | None = None


class CareerError(Exception):
    """A move the rules don't allow (the API answers 409)."""


def _rng(*parts: object) -> np.random.Generator:
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).digest()
    return np.random.default_rng(int.from_bytes(digest[:8], "big"))


def _tier_index(tier: Tier) -> int:
    return TIERS.index(tier)


def new_career(code: str, player_id: str | None = None) -> Career:
    rng = _rng("career", code)
    culprit = list(CAMEOS)[int(rng.integers(len(CAMEOS)))]  # who it was, all along
    return Career(code=code, player_id=player_id, created=time.time(),
                  offers=[c.id for c in companies_in("small")], final_culprit=culprit)


def worked_at(career: Career) -> list[str]:
    seen: list[str] = []
    for a in career.history:
        if a.company_id not in seen and a.tier != "final":
            seen.append(a.company_id)
    return seen


# ── Signing a contract ────────────────────────────────────────────────────────────

def _pick_cameos(career: Career, rng: np.random.Generator) -> list[str]:
    """Your first company: all three. After that: 1 (60%) or 2 (40%), and whoever just
    appeared becomes less likely to come next (their weight halves)."""
    ids = list(CAMEOS)
    if not any(not a.practice for a in career.history):
        return ids
    k = 2 if rng.random() < 0.4 else 1
    weights = np.array([career.cameo_weights[c] for c in ids])
    picks = [ids[int(i)] for i in rng.choice(len(ids), size=k, replace=False,
                                             p=weights / weights.sum())]
    for c in picks:
        career.cameo_weights[c] /= 2
    return picks


def _greeting(career: Career, cameo_id: str, company_id: str) -> Greeting:
    cameo = CAMEOS[cameo_id]
    person = cameo_person(cameo_id, COMPANIES[company_id])
    last = career.cameo_last.get(cameo_id)
    line = cameo.reunion.format(last=COMPANIES[last].name) if last else cameo.intro
    return Greeting(cameo=cameo_id, name=cameo.name, portrait=person.portrait, role=person.role,
                    line=line, last_company=COMPANIES[last].name if last else None)


def sign(career: Career, company_id: str, practice: bool = False) -> Contract:
    if career.status == "contract":
        raise CareerError("Finish the contract you signed first")
    if career.status == "retired":
        raise CareerError("This career is retired")
    company = COMPANIES.get(company_id)
    if company is None:
        raise CareerError("No such company")
    if practice:
        if company_id not in worked_at(career):
            raise CareerError("You can only replay companies you've worked for")
    else:
        if career.status == "ended":
            raise CareerError("The story is over — replay companies as practice")
        if company_id not in career.offers:
            raise CareerError("That company hasn't made you an offer")
        career.offers.remove(company_id)
        if company.tier != "final" and _tier_index(company.tier) > _tier_index(career.tier):
            career.salary = max(career.salary, TIER_SPECS[company.tier].base)  # promotion
        career.tier = company.tier

    rng = _rng("contract", career.code, career.year, company_id, len(career.history))
    cameos = list(CAMEOS) if company.tier == "final" else ([] if practice else
                                                           _pick_cameos(career, rng))
    plans = plan_contract(company, rng, career.tool_counts, career.final_culprit)
    career.contract = Contract(
        company_id=company_id, year=career.year, practice=practice, cameos=cameos,
        greetings=[_greeting(career, c, company_id) for c in cameos],
        cases=[CaseRecord(index=p.index, difficulty=p.difficulty, seed=p.seed,
                          schemes=list(p.schemes), herrings=list(p.herrings),
                          forced_cameo=p.forced_cameo) for p in plans],
    )
    career.status = "contract"
    return career.contract


def current_case(career: Career) -> CaseRecord:
    if career.status != "contract" or career.contract is None:
        raise CareerError("No contract in progress")
    return next(c for c in career.contract.cases if c.rating is None)


# ── Closing a case ────────────────────────────────────────────────────────────────

def record_case(career: Career, index: int, rating: CaseRating, tools_used: list[str],
                caught_cameo: bool | None = None) -> Appraisal | None:
    """Store a verdict. Returns the appraisal when it was the contract's last case."""
    case = career.contract.cases[index]
    case.rating = rating
    case.correct = rating.caught == rating.culprits
    case.caught_cameo = caught_cameo
    for tool in tools_used:
        career.tool_counts[tool] = career.tool_counts.get(tool, 0) + 1
    if all(c.rating is not None for c in career.contract.cases):
        return appraise(career)
    return None


def _offer(career: Career, tier: Tier, k: int, rng: np.random.Generator,
           skip: tuple[str, ...] = ()) -> list[str]:
    pool = [c.id for c in companies_in(tier)
            if c.id not in career.offers and c.id not in skip
            and not career.companies.get(c.id, CompanyRecord()).banned]
    picks = [pool[int(i)] for i in rng.permutation(len(pool))[:k]]
    career.offers.extend(picks)
    return picks


def appraise(career: Career) -> Appraisal:
    contract = career.contract
    company = COMPANIES[contract.company_id]
    ratings = [c.rating.total for c in contract.cases]
    hardest = [c for c in contract.cases if c.difficulty in ("hard", "very_hard")]
    band = contract_band(ratings, all(c.correct for c in contract.cases),
                         all(c.correct for c in hardest))
    before = career.salary
    events: list[str] = []
    new: list[str] = []
    rng = _rng("appraisal", career.code, career.year, company.id)

    if company.tier == "final":
        _close_final(career, events)
    elif not contract.practice:
        new = _apply_rules(career, company.id, band, rng, events)
        _remember_cameos(career, contract)
    else:
        events.append("Practice: recorded, but no raise and no promotion credit.")

    appraisal = Appraisal(
        company_id=company.id, company=company.name, tier=company.tier, year=contract.year,
        practice=contract.practice, ratings=ratings,
        average=round(sum(ratings) / len(ratings), 1), band=band, salary_before=before,
        salary_after=career.salary, events=events, new_offers=new)
    career.history.append(appraisal)
    career.contract = None
    if not contract.practice:
        career.year += 1
    career.status = "ended" if career.ending else "offers"
    return appraisal


def _apply_rules(career: Career, company_id: str, band: Band, rng: np.random.Generator,
                 events: list[str]) -> list[str]:
    company = COMPANIES[company_id]
    tier = company.tier
    spec = TIER_SPECS[tier]
    record = career.companies.setdefault(company_id, CompanyRecord())
    record.contracts += 1
    record.bad_streak = record.bad_streak + 1 if band == "bad" else 0
    offered_before = list(career.offers)

    if band != "bad":
        raised = career.salary * (1 + spec.hikes[band])
        career.salary = round(max(career.salary, min(raised, spec.ceiling)), 2)

    if band == "bad" and record.bad_streak >= 2:
        _fire(career, company_id, rng, events)
    elif band == "bad":
        if company_id not in career.offers:
            career.offers.append(company_id)
        events.append(f"A bad year. No new offers — but {company.name} will let you start "
                      "over, with fresh cases.")
    elif band == "ok":
        events.append("A steady year. Your offers stand."
                      + (" Your mid-tier streak is paused, not lost." if tier == "mid" else ""))
    elif tier == "small":
        _offer(career, "mid", int(rng.integers(1, 4)), rng)
        events.append("Word gets around. Mid-size firms want to talk to you.")
        if band == "exceptional":
            _offer(career, "large", 1, rng)
            events.append("Exceptional work — a large company is calling already.")
    elif tier == "mid":
        if company_id not in career.mid_good:
            career.mid_good.append(company_id)
        if len(career.mid_good) >= 2:
            _offer(career, "large", int(rng.integers(1, 3)), rng)
            events.append("Two good years at two firms. The large companies are calling.")
        else:
            _offer(career, "mid", int(rng.integers(1, 3)), rng, skip=tuple(career.mid_good))
            events.append("One more good contract at another mid-size firm opens the large "
                          "companies.")
    elif tier == "large":
        if band == "exceptional" and company_id not in career.large_exceptional:
            career.large_exceptional.append(company_id)
        if len(career.large_exceptional) >= 2:
            _offer(career, "very_large", 2, rng)
            events.append("Exceptional twice over. The very large companies want you.")
        else:
            _offer(career, "large", 3, rng, skip=tuple(career.large_exceptional))
            events.append(f"Exceptional at {len(career.large_exceptional)} of the 2 large "
                          "companies you need.")
    elif tier == "very_large":
        if band == "exceptional" and company_id not in career.vl_exceptional:
            career.vl_exceptional.append(company_id)
        if len(career.vl_exceptional) >= 2:
            if "kaveri" not in career.offers:
                career.offers.append("kaveri")
            events.append("A letter from New Delhi. The Commission wants you for the Kaveri "
                          "Inquiry.")
        else:
            _offer(career, "very_large", 2, rng, skip=tuple(career.vl_exceptional))
            events.append(f"Exceptional at {len(career.vl_exceptional)} of the 2 very large "
                          "companies.")

    if not career.offers:  # there is always somewhere to work
        _offer(career, "small", 3, rng) or career.offers.append(company_id)
    return [o for o in career.offers if o not in offered_before]


def _fire(career: Career, company_id: str, rng: np.random.Generator, events: list[str]) -> None:
    company = COMPANIES[company_id]
    tier = company.tier
    career.companies[company_id].bad_streak = 0
    if tier == "small":
        career.companies[company_id].banned = True
        career.offers = [o for o in career.offers if o != company_id]
        _offer(career, "small", 3, rng)
        career.salary = TIER_SPECS["small"].base
        events.append(f"Fired. {company.name} won't hire you again — but the other small firms "
                      "will.")
        return
    lower = TIERS[_tier_index(tier) - 1]
    career.offers = [o for o in career.offers
                     if _tier_index(COMPANIES[o].tier) < _tier_index(tier)]
    _offer(career, lower, 2, rng)
    career.tier = lower
    career.salary = TIER_SPECS[lower].base
    if _tier_index(tier) <= _tier_index("mid"):
        career.mid_good = []
    if _tier_index(tier) <= _tier_index("large"):
        career.large_exceptional = []
    career.vl_exceptional = []
    events.append(f"Fired. Two bad years in a row at {company.name}. Back to "
                  f"{TIER_NAMES[lower].lower()} firms, at their starting salary.")


def _remember_cameos(career: Career, contract: Contract) -> None:
    company = COMPANIES[contract.company_id]
    for greeting in contract.greetings:
        lineups = sum(greeting.cameo in c.lineup_cameos for c in contract.cases)
        career.cameo_trail.setdefault(greeting.cameo, []).append(TrailStop(
            company_id=company.id, company=company.name, year=contract.year,
            role=greeting.role, line=greeting.line, lineups=lineups))
        career.cameo_last[greeting.cameo] = company.id


def _close_final(career: Career, events: list[str]) -> None:
    """The story ends after the Final's last case, whatever happened (CAREER.md §4.1)."""
    contract = career.contract
    _remember_cameos(career, contract)
    caught = bool(contract.cases[-1].caught_cameo)
    career.ending = "caught" if caught else "escaped"
    culprit = CAMEOS[career.final_culprit].name
    if caught:
        career.salary = TIER_SPECS["final"].base
        career.title = CHIEF_AUDITOR
        events.append(f"You caught {culprit}. The Commission names you Chief Auditor.")
    else:
        events.append(f"{culprit} walked out of the building. The Commission lets you go, "
                      "quietly.")


def next_goal(career: Career) -> str:
    if career.status == "retired":
        return "This career is retired."
    if career.ending == "caught":
        return "Chief Auditor. The story is done — replay any company for practice."
    if career.ending == "escaped":
        return "They got away. The story is done — replay any company for practice."
    tier = career.tier
    if tier == "small":
        return "One Good contract brings offers from mid-size firms."
    if tier == "mid":
        return ("Good contracts at two different mid-size firms open the large companies "
                f"({len(career.mid_good)}/2).")
    if tier == "large":
        return ("Exceptional at two of the three large companies opens the very large ones "
                f"({len(career.large_exceptional)}/2).")
    if tier == "very_large":
        return ("Exceptional at both very large companies opens the Final "
                f"({len(career.vl_exceptional)}/2).")
    return "The Final: three cases, played once."
