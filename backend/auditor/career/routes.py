"""Career Mode's HTTP routes. Cases run through the normal case routes (tools, rows, state);
only starting a case and accusing are career-specific."""

import os
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints

from auditor.career.cases import CasePlan, build_career_case, intended_cost, telling_rows
from auditor.career.catalog import CAMEOS, COMPANIES, TIER_NAMES, TIER_SPECS, Band, Tier
from auditor.career.people import company_people
from auditor.career.proof import THEORIES, THEORY_BY_ID, Theory
from auditor.career.rating import MAX_EXHIBITS, CaseRating, Charge, contract_band, rate_case
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
from auditor.career.seniors import SeniorNotes, notes_for
from auditor.career.storage import CareerStore, normalise_code
from auditor.charts import reveal_figure
from auditor.models import (
    CaseMeta,
    EvidenceGrade,
    SchemeId,
    Suspect,
    ToolId,
)
from auditor.results import records, tool_result
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
    senior: SeniorNotes | None  # their notes on this company (nobody in the Final)
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
    theories: list[Theory]  # the kinds of fraud you can name, and the tools that prove each


class CareerCreate(BaseModel):
    player_id: Annotated[str, StringConstraints(max_length=64)] | None = None


class Sign(BaseModel):
    company_id: str
    practice: bool = False


class DebugJump(BaseModel):
    """Testing and demos only (AUDITOR_DEBUG=1): put a career anywhere on the ladder."""

    offers: list[str]
    tier: Tier
    salary: float | None = None


Short = Annotated[str, StringConstraints(max_length=24)]


class Charged(BaseModel):
    """One accusation: who, the trick you think they used, your clues and the rows that show it."""

    suspect_id: Short
    theory: SchemeId
    evidence_ids: list[Short] = Field(min_length=1, max_length=2)
    exhibits: list[Short] = Field(min_length=1, max_length=MAX_EXHIBITS)  # txn ids


class CareerAccusation(BaseModel):
    accusations: list[Charged] = Field(min_length=1, max_length=2)


class SuspectRows(BaseModel):
    suspect_id: str
    rows: list[dict]


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


def _so_far(ratings: list[float], cases, tier: Tier) -> tuple[float, Band]:
    average = round(sum(ratings) / len(ratings), 1)
    done = [c for c in cases if c.rating is not None]
    hard = [c for c in done if c.difficulty in ("hard", "very_hard")]
    return average, contract_band(ratings, all(c.correct for c in done),
                                  all(c.correct for c in hard), TIER_SPECS[tier].exceptional)


def view(career: Career) -> CareerView:
    contract = None
    if career.contract:
        k = career.contract
        ratings = [c.rating.total for c in k.cases if c.rating]
        tier = COMPANIES[k.company_id].tier
        average, band = _so_far(ratings, k.cases, tier) if ratings else (None, None)
        contract = ContractView(
            company=card(k.company_id), year=k.year, practice=k.practice,
            greetings=k.greetings, senior=notes_for(k.company_id, tier),
            cases=[CaseSlot(index=c.index + 1, difficulty=c.difficulty,
                            rating=c.rating.total if c.rating else None, correct=c.correct,
                            case_id=c.case_id) for c in k.cases],
            average=average, band_so_far=band)
    return CareerView(
        code=career.code, status=career.status, year=career.year, tier=career.tier,
        tier_name=TIER_NAMES[career.tier], salary=career.salary, title=career.title,
        ending=career.ending, goal=next_goal(career),
        offers=[card(o) for o in career.offers], contract=contract, history=career.history,
        worked_at=[card(c) for c in worked_at(career)], theories=THEORIES)


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


def catchers(scheme: SchemeId, unlocked: list[ToolId]) -> list[ToolId]:
    """The tools that prove a trick (THEORIES), as far as this case has them."""
    tools = [f.tool for f in THEORY_BY_ID[scheme].fits if f.tool in unlocked]
    return list(dict.fromkeys(tools))


MISSES_PER_MINUTE = 30  # unknown career codes one address may try: codes can't be guessed


def register_career(app, store: SessionStore, careers: CareerStore,
                    log: Callable[..., None],
                    limit: Callable[..., None] = lambda *_a, **_k: None) -> None:
    router = APIRouter(prefix="/api/career")

    def load(code: str, request: Request | None = None) -> Career:
        """The live career, read-only."""
        try:
            return careers.get(normalise_code(code))
        except KeyError:
            if request is not None:
                limit(request, "career-misses", MISSES_PER_MINUTE)
            raise HTTPException(404, "No career with that code") from None

    def editable(code: str) -> Career:
        """A private copy to change; `careers.save` swaps it in. Call it holding the lock."""
        return load(code).model_copy(deep=True)

    def rules(fn):
        try:
            return fn()
        except CareerError as exc:
            raise HTTPException(409, str(exc)) from None

    @router.post("", response_model=CareerView)
    def create(request: Request, body: CareerCreate | None = None):
        limit(request, "careers")
        career = new_career(careers.unused_code(), (body or CareerCreate()).player_id)
        careers.save(career)
        return view(career)

    @router.get("/{code}", response_model=CareerView)
    def get(code: str, request: Request):
        return view(load(code, request))

    @router.get("/{code}/ending", response_model=Cutscene)
    def ending(code: str, request: Request):
        scene = cutscene(load(code, request))
        if scene is None:
            raise HTTPException(404, "The story isn't over yet")
        return scene

    @router.post("/{code}/sign", response_model=CareerView)
    def sign_contract(code: str, body: Sign, request: Request):
        code = load(code, request).code
        with careers.lock(code):
            career = editable(code)
            rules(lambda: sign(career, body.company_id, body.practice))
            careers.save(career)
        return view(career)

    @router.post("/{code}/retire", response_model=CareerView)
    def retire(code: str, request: Request):
        """Start over. Retiring twice hands back the same fresh career."""
        code = load(code, request).code
        with careers.lock(code):
            career = editable(code)
            if career.status == "retired" and career.successor:
                return view(load(career.successor))
            limit(request, "careers")
            fresh = new_career(careers.unused_code(), career.player_id)
            career.status, career.successor = "retired", fresh.code
            careers.save(fresh)
            careers.save(career)
        return view(fresh)

    @router.post("/{code}/case", response_model=CaseMeta)
    def open_case(code: str, request: Request):
        """The contract's current case — created on first call, rebuilt if the server forgot."""
        code = load(code, request).code
        with careers.lock(code):
            career = editable(code)
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
        with careers.lock(session.career_code), session.lock:
            if session.career_verdict is not None:
                return session.career_verdict  # one shot, no take-backs
            career = editable(session.career_code)
            if career.status == "retired":
                raise HTTPException(409, "This career is retired")
            contract = career.contract
            if (career.status != "contract" or contract is None
                    or session.career_index >= len(contract.cases)
                    or contract.cases[session.career_index].case_id != case_id
                    or contract.cases[session.career_index].rating is not None):
                raise HTTPException(409, "This case is no longer open")
            meta = session.bundle.meta
            truth = session.bundle.truth
            culprits = truth.culprits()
            accusations = body.accusations
            _check(accusations, session, len(culprits))

            results = list(session.results.values())
            filed = [(a.suspect_id, [session.results[e] for e in a.evidence_ids])
                     for a in accusations]
            charges = [Charge(suspect=a.suspect_id, theory=a.theory, clues=clues,
                              exhibits=a.exhibits)
                       for a, (_, clues) in zip(accusations, filed, strict=True)]
            schemes = [c.scheme for c in culprits]
            tier = COMPANIES[meta.career.company_id].tier
            df = session.bundle.df
            rating = rate_case(culprits, charges, meta.budget - session.budget_left,
                               intended_cost(schemes, meta.unlocked_tools),
                               TIER_SPECS[tier].slack,
                               {c.fraudster_id: telling_rows(df, c) for c in culprits})

            accused_ids = {a.suspect_id for a in accusations}
            first_target = next((a for a in accusations if a.suspect_id == truth.fraudster_id),
                                accusations[0])
            names = {s.id: s.name for s in meta.suspects}
            verdict = score_accusation(truth, meta.suspects, first_target.suspect_id,
                                       [session.results[e] for e in first_target.evidence_ids],
                                       session.budget_left)
            reveals = []
            for c in culprits:
                fig = reveal_figure(df, c.fraudster_id, c.fraud_txn_ids, names)
                reveals.append(CulpritReveal(
                    fraudster=next(s for s in meta.suspects if s.id == c.fraudster_id),
                    scheme=c.scheme, explanation=c.explanation,
                    fraud_txn_ids=c.fraud_txn_ids,
                    catching_tools=catchers(c.scheme, meta.unlocked_tools),
                    reveal_figure=fig, caught=c.fraudster_id in accused_ids))
            verdict.reveal_figure = reveals[0].reveal_figure
            grades = []
            for suspect_id, clues in filed:
                target = next((c for c in culprits if c.fraudster_id == suspect_id), culprits[0])
                grades += [grade_evidence(r, suspect_id,
                                          catchers(target.scheme, meta.unlocked_tools))
                           for r in clues]

            record_index = session.career_index
            forced = career.contract.cases[record_index].forced_cameo
            caught_cameo = None
            if forced:
                caught_cameo = any(session.lineup_cameos.get(s) == forced for s in accused_ids
                                   if any(c.fraudster_id == s for c in culprits))
            appraisal = rules(lambda: record_case(
                career, record_index, rating, [r.tool_id for r in results if r.cost_charged > 0],
                caught_cameo))
            careers.save(career)

            cases = (career.contract.cases if career.contract else None)
            ratings = ([c.rating.total if c.rating else None for c in cases] if cases
                       else appraisal.ratings)
            done = [r for r in ratings if r is not None]
            average, band = (_so_far(done, cases, tier) if cases else
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

    @router.get("/cases/{case_id}/suspects/{suspect_id}/rows", response_model=SuspectRows)
    def suspect_rows(case_id: str, suspect_id: str):
        """One suspect's transactions, biggest first: where you pick your exhibits."""
        session = store.get(case_id)
        if session.career_code is None:
            raise HTTPException(409, "Not a career case")
        if suspect_id not in {s.id for s in session.bundle.meta.suspects}:
            raise HTTPException(404, "No such suspect")
        df = session.bundle.df
        mine = df[df["employee_id"] == suspect_id].sort_values("amount", ascending=False)
        return SuspectRows(suspect_id=suspect_id, rows=records(mine))

    @router.post("/{code}/debug-jump", response_model=CareerView)
    def debug_jump(code: str, body: DebugJump):
        if os.getenv("AUDITOR_DEBUG") != "1":
            raise HTTPException(404, "Not Found")
        code = load(code).code
        with careers.lock(code):
            career = editable(code)
            if career.status == "contract" or any(o not in COMPANIES for o in body.offers):
                raise HTTPException(409, "Can't jump from here")
            career.offers, career.tier = body.offers, body.tier
            if body.salary is not None:
                career.salary = body.salary
            # pretend you've already met everyone, so greetings and the Final have a past
            if not career.cameo_last:
                career.cameo_last = {c: "lakshmi" for c in CAMEOS}
            careers.save(career)
        return view(career)

    app.include_router(router)


def _check(accusations: list[Charged], session: CaseSession, culprits: int) -> None:
    """One accusation per fraudster, each with a theory, one or two clues (the model checks the
    counts) and exhibits: rows from the accused's own ledger."""
    if len(accusations) != culprits:
        raise HTTPException(422, f"Accuse {culprits} suspect{'s' if culprits > 1 else ''}")
    suspects = {s.id for s in session.bundle.meta.suspects}
    if len({a.suspect_id for a in accusations}) != culprits or any(
            a.suspect_id not in suspects for a in accusations):
        raise HTTPException(422, "Accuse different suspects from this case")
    # One result may back both accusations (it can name both fraudsters), never twice in one
    if any(len(set(a.evidence_ids)) != len(a.evidence_ids) for a in accusations) or any(
            e not in session.results for a in accusations for e in a.evidence_ids):
        raise HTTPException(422, "Attach different pieces of evidence from this case")
    df = session.bundle.df
    owner = dict(zip(df["txn_id"], df["employee_id"], strict=True))
    for a in accusations:
        if len(set(a.exhibits)) != len(a.exhibits) or any(
                owner.get(t) != a.suspect_id for t in a.exhibits):
            raise HTTPException(422, "Exhibits must be different rows from the accused's own "
                                     "transactions")
