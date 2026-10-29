"""Career Mode's HTTP routes. Cases run through the normal case routes (tools, rows, state);
only starting a case and accusing are career-specific."""

import os
from collections.abc import Callable
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from auditor.career.cases import CasePlan, build_career_case, intended_cost
from auditor.career.catalog import CAMEOS, COMPANIES, TIER_NAMES, TIER_SPECS, Band, Tier
from auditor.career.people import company_people
from auditor.career.rating import CaseRating, contract_band, rate_case
from auditor.career.rules import (
    Appraisal,
    Career,
    CareerError,
    Greeting,
    TrailStop,
    current_case,
    new_career,
    next_goal,
    record_case,
    sign,
    worked_at,
)
from auditor.career.storage import CareerStore, normalise_code
from auditor.charts import reveal_figure
from auditor.models import (
    Accusation,
    CaseMeta,
    EvidenceGrade,
    SchemeId,
    Suspect,
    ToolId,
)
from auditor.results import tool_result
from auditor.scoring import grade_evidence, score_accusation
from auditor.store import CaseSession, SessionStore


class CompanyCard(BaseModel):
    id: str
    name: str
    city: str
    industry: str
    tier: Tier
    tier_name: str
    letter: str
    culture_note: str
    base_salary: float
    cases: int


class CaseSlot(BaseModel):
    index: int
    difficulty: str
    rating: float | None
    correct: bool | None
    case_id: str | None


class ContractView(BaseModel):
    company: CompanyCard
    year: int
    practice: bool
    greetings: list[Greeting]
    cases: list[CaseSlot]
    average: float | None
    band_so_far: Band | None


class CareerView(BaseModel):
    code: str
    status: str
    year: int
    tier: Tier
    tier_name: str
    salary: float
    title: str | None
    ending: str | None
    goal: str
    offers: list[CompanyCard]
    contract: ContractView | None
    history: list[Appraisal]
    worked_at: list[CompanyCard]


class CareerCreate(BaseModel):
    player_id: str | None = None


class Sign(BaseModel):
    company_id: str
    practice: bool = False


class DebugJump(BaseModel):
    """Testing and demos only (AUDITOR_DEBUG=1): put a career anywhere on the ladder."""

    offers: list[str]
    tier: Tier
    salary: float | None = None


class CareerAccusation(BaseModel):
    accusations: list[Accusation] = Field(min_length=1, max_length=2)


class CulpritReveal(BaseModel):
    fraudster: Suspect
    scheme: SchemeId
    explanation: str
    fraud_txn_ids: list[str]
    catching_tools: list[ToolId]
    reveal_figure: dict
    caught: bool


class Progress(BaseModel):
    company: str
    index: int
    total: int
    ratings: list[float | None]
    average: float
    band_so_far: Band


class Cutscene(BaseModel):
    kind: Literal["caught", "escaped"]
    name: str
    portrait: str
    speech: str
    closing: str
    stops: list[TrailStop]


class CareerVerdict(BaseModel):
    correct: bool
    accused: list[str]
    culprits: list[CulpritReveal]
    evidence: list[EvidenceGrade]
    rating: CaseRating
    progress: Progress
    appraisal: Appraisal | None
    cutscene: Cutscene | None


def card(company_id: str) -> CompanyCard:
    c = COMPANIES[company_id]
    return CompanyCard(id=c.id, name=c.name, city=c.city, industry=c.industry, tier=c.tier,
                       tier_name=TIER_NAMES[c.tier], letter=c.letter,
                       culture_note=c.culture_note, base_salary=TIER_SPECS[c.tier].base,
                       cases=len(TIER_SPECS[c.tier].plan))


def _so_far(ratings: list[float], cases) -> tuple[float, Band]:
    average = round(sum(ratings) / len(ratings), 1)
    done = [c for c in cases if c.rating is not None]
    hard = [c for c in done if c.difficulty in ("hard", "very_hard")]
    return average, contract_band(ratings, all(c.correct for c in done),
                                  all(c.correct for c in hard))


def view(career: Career) -> CareerView:
    contract = None
    if career.contract:
        k = career.contract
        ratings = [c.rating.total for c in k.cases if c.rating]
        average, band = _so_far(ratings, k.cases) if ratings else (None, None)
        contract = ContractView(
            company=card(k.company_id), year=k.year, practice=k.practice,
            greetings=k.greetings,
            cases=[CaseSlot(index=c.index + 1, difficulty=c.difficulty,
                            rating=c.rating.total if c.rating else None, correct=c.correct,
                            case_id=c.case_id) for c in k.cases],
            average=average, band_so_far=band)
    return CareerView(
        code=career.code, status=career.status, year=career.year, tier=career.tier,
        tier_name=TIER_NAMES[career.tier], salary=career.salary, title=career.title,
        ending=career.ending, goal=next_goal(career),
        offers=[card(o) for o in career.offers], contract=contract, history=career.history,
        worked_at=[card(c) for c in worked_at(career)])


def cutscene(career: Career) -> Cutscene | None:
    if career.ending is None:
        return None
    cameo = CAMEOS[career.final_culprit]
    stops = career.cameo_trail.get(cameo.id, [])
    caught = career.ending == "caught"
    return Cutscene(
        kind=career.ending, name=cameo.name, portrait=f"{cameo.look}-cameo-{cameo.id}",
        speech=cameo.confession if caught else cameo.escape,
        closing=("You checked the numbers, even the friendly ones. That's the whole job."
                 if caught else "They were with you from the start. You never once checked "
                                "their numbers."),
        stops=stops)


def register_career(app, store: SessionStore, careers: CareerStore,
                    log: Callable[..., None]) -> None:
    router = APIRouter(prefix="/api/career")

    def load(code: str) -> Career:
        try:
            return careers.get(normalise_code(code))
        except KeyError:
            raise HTTPException(404, "No career with that code") from None

    def rules(fn):
        try:
            return fn()
        except CareerError as exc:
            raise HTTPException(409, str(exc)) from None

    @router.post("", response_model=CareerView)
    def create(body: CareerCreate | None = None):
        career = new_career(careers.unused_code(), (body or CareerCreate()).player_id)
        careers.save(career)
        return view(career)

    @router.get("/{code}", response_model=CareerView)
    def get(code: str):
        return view(load(code))

    @router.get("/{code}/ending", response_model=Cutscene)
    def ending(code: str):
        scene = cutscene(load(code))
        if scene is None:
            raise HTTPException(404, "The story isn't over yet")
        return scene

    @router.post("/{code}/sign", response_model=CareerView)
    def sign_contract(code: str, body: Sign):
        career = load(code)
        with careers.lock(career.code):
            rules(lambda: sign(career, body.company_id, body.practice))
            careers.save(career)
        return view(career)

    @router.post("/{code}/retire", response_model=CareerView)
    def retire(code: str):
        career = load(code)
        with careers.lock(career.code):
            career.status = "retired"
            careers.save(career)
        fresh = new_career(careers.unused_code(), career.player_id)
        careers.save(fresh)
        return view(fresh)

    @router.post("/{code}/case", response_model=CaseMeta)
    def open_case(code: str):
        """The contract's current case — created on first call, rebuilt if the server forgot."""
        career = load(code)
        with careers.lock(career.code):
            record = rules(lambda: current_case(career))
            if record.case_id:
                try:
                    session = store.get(record.case_id)
                    return session.bundle.meta.model_copy(
                        update={"budget_left": session.budget_left})
                except KeyError:
                    pass  # restarted server: rebuild the same case from its seed
            contract = career.contract
            people = company_people(contract.company_id, contract.cameos)
            plan = CasePlan(contract.company_id, record.index, record.difficulty,
                            tuple(record.schemes), tuple(record.herrings), record.seed,
                            record.forced_cameo)
            case_id = record.case_id or SessionStore.new_id()
            bundle, lineup = build_career_case(plan, people, career.code, case_id,
                                               len(contract.cases))
            session = CaseSession(bundle=bundle, budget_left=bundle.meta.budget, started_at=0,
                                  player_id=career.player_id, career_code=career.code,
                                  career_index=record.index,
                                  lineup_cameos={s.id: p.cameo for s, p in
                                                 zip(bundle.meta.suspects, lineup) if p.cameo})
            # Every career case opens with a free Case Summary: look at the data first
            names = {s.id: s.name for s in bundle.meta.suspects}
            summary = tool_result("summary", bundle.df, {}, names, 0, session.budget_left)
            session.results[summary.result_id] = summary
            session.cache[("summary", ())] = summary.result_id
            store.create(session)
            record.case_id = case_id
            record.lineup_cameos = sorted(set(session.lineup_cameos.values()))
            careers.save(career)
        log("case_started", session, payload={"level": bundle.meta.level, "seed": record.seed,
                                              "career": career.code,
                                              "company": contract.company_id,
                                              "index": record.index})
        return bundle.meta

    @router.post("/cases/{case_id}/accuse", response_model=CareerVerdict)
    def accuse(case_id: str, body: CareerAccusation):
        session = store.get(case_id)
        if session.career_code is None:
            raise HTTPException(409, "Not a career case")
        career = load(session.career_code)
        with careers.lock(career.code), session.lock:
            if session.career_verdict is not None:
                return session.career_verdict  # one shot, no take-backs
            meta = session.bundle.meta
            truth = session.bundle.truth
            culprits = truth.culprits()
            accusations = body.accusations
            _check(accusations, session, len(culprits))

            results = list(session.results.values())
            filed = [(a.suspect_id, [session.results[e] for e in a.evidence_ids])
                     for a in accusations]
            schemes = [c.scheme for c in culprits]
            rating = rate_case(culprits, filed, results, meta.budget - session.budget_left,
                               intended_cost(schemes, meta.unlocked_tools))

            accused_ids = {a.suspect_id for a in accusations}
            first_target = next((a for a in accusations if a.suspect_id == truth.fraudster_id),
                                accusations[0])
            names = {s.id: s.name for s in meta.suspects}
            verdict = score_accusation(truth, meta.suspects, first_target.suspect_id,
                                       [session.results[e] for e in first_target.evidence_ids],
                                       session.budget_left)
            reveals = []
            for c in culprits:
                fig = reveal_figure(session.bundle.df, c.fraudster_id, c.fraud_txn_ids, names)
                reveals.append(CulpritReveal(
                    fraudster=next(s for s in meta.suspects if s.id == c.fraudster_id),
                    scheme=c.scheme, explanation=c.explanation,
                    fraud_txn_ids=c.fraud_txn_ids, catching_tools=c.catching_tools,
                    reveal_figure=fig, caught=c.fraudster_id in accused_ids))
            verdict.reveal_figure = reveals[0].reveal_figure
            grades = []
            for suspect_id, clues in filed:
                target = next((c for c in culprits if c.fraudster_id == suspect_id), culprits[0])
                grades += [grade_evidence(r, suspect_id, target.catching_tools) for r in clues]

            record_index = session.career_index
            forced = career.contract.cases[record_index].forced_cameo
            caught_cameo = None
            if forced:
                caught_cameo = any(session.lineup_cameos.get(s) == forced for s in accused_ids
                                   if any(c.fraudster_id == s for c in culprits))
            appraisal = record_case(career, record_index, rating,
                                    [r.tool_id for r in results if r.cost_charged > 0],
                                    caught_cameo)
            careers.save(career)

            cases = (career.contract.cases if career.contract else None)
            ratings = ([c.rating.total if c.rating else None for c in cases] if cases
                       else appraisal.ratings)
            done = [r for r in ratings if r is not None]
            average, band = (_so_far(done, cases) if cases else
                             (appraisal.average, appraisal.band))
            result = CareerVerdict(
                correct=rating.caught == rating.culprits,
                accused=[a.suspect_id for a in accusations],
                culprits=reveals, evidence=grades, rating=rating,
                progress=Progress(company=meta.career.company, index=meta.career.index,
                                  total=meta.career.total, ratings=ratings, average=average,
                                  band_so_far=band),
                appraisal=appraisal,
                cutscene=cutscene(career) if appraisal and career.ending else None)
            session.verdict = verdict
            session.career_verdict = result
        log("accused", session, payload={
            "level": meta.level, "accused": [a.suspect_id for a in accusations],
            "correct": result.correct, "score": verdict.score, "rating": rating.total,
            "budget_left": session.budget_left, "n_tools": len(results),
            "career": career.code, "evidence": [g.grade for g in grades]})
        return result

    @router.post("/{code}/debug-jump", response_model=CareerView)
    def debug_jump(code: str, body: DebugJump):
        if os.getenv("AUDITOR_DEBUG") != "1":
            raise HTTPException(404, "Not Found")
        career = load(code)
        if career.status == "contract" or any(o not in COMPANIES for o in body.offers):
            raise HTTPException(409, "Can't jump from here")
        with careers.lock(career.code):
            career.offers, career.tier = body.offers, body.tier
            if body.salary is not None:
                career.salary = body.salary
            # pretend you've already met everyone, so greetings and the Final have a past
            if not career.cameo_last:
                career.cameo_last = {c: "lakshmi" for c in CAMEOS}
            careers.save(career)
        return view(career)

    app.include_router(router)


def _check(accusations: list[Accusation], session: CaseSession, culprits: int) -> None:
    """One accusation per fraudster, each with two clues — fewer only when the budget is spent
    (then every clue you have, or up to two each when there are two fraudsters)."""
    if len(accusations) != culprits:
        raise HTTPException(422, f"Accuse {culprits} suspect{'s' if culprits > 1 else ''}")
    suspects = {s.id for s in session.bundle.meta.suspects}
    if len({a.suspect_id for a in accusations}) != culprits or any(
            a.suspect_id not in suspects for a in accusations):
        raise HTTPException(422, "Accuse different suspects from this case")
    ids = [e for a in accusations for e in a.evidence_ids]
    if len(set(ids)) != len(ids) or any(e not in session.results for e in ids):
        raise HTTPException(422, "Attach different pieces of evidence from this case")
    if session.budget_left > 0:
        if any(len(a.evidence_ids) != 2 for a in accusations):
            raise HTTPException(422, "Attach two different pieces of pinned evidence to each "
                                     "suspect")
    elif culprits == 1 and len(ids) != min(2, len(session.results)):
        raise HTTPException(422, "Attach every clue you have")
    elif any(len(a.evidence_ids) > 2 for a in accusations):
        raise HTTPException(422, "At most two clues per suspect")
