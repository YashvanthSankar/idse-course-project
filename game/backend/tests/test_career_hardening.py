"""Career Mode under real conditions: a slow or failing database, retries, retired careers,
stale cases, guessing codes, the Final's big lineup, and careers saved by older versions."""

import json
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from auditor.api import create_app
from auditor.career import storage
from auditor.career.cases import CasePlan, build_career_case, telling_rows
from auditor.career.people import company_people
from auditor.career.rating import CaseRating
from auditor.career.rules import CareerError, CompanyRecord, new_career, record_case, sign
from auditor.career.storage import CareerStore, careers
from auditor.generator.cases import build_case
from auditor.interrogation import THEMES, statements
from auditor.store import CaseSession, SessionStore
from auditor.telemetry import Telemetry
from tests.test_career_api import play_case, rows_of
from tests.test_career_rules import finish


@pytest.fixture
def app(tmp_path):
    return create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                      careers=CareerStore(str(tmp_path / "t.db")))


@pytest.fixture
def client(app):
    return TestClient(app)


def stored(store: CareerStore, code: str) -> dict | None:
    with store._engine.connect() as conn:
        row = conn.execute(select(careers.c.state).where(careers.c.code == code)).first()
    return json.loads(row.state) if row else None


# ── storage ───────────────────────────────────────────────────────────────────────

def test_saves_never_wait_for_the_database(tmp_path, monkeypatch):
    store = CareerStore(str(tmp_path / "c.db"))
    slow = store._write
    monkeypatch.setattr(store, "_write", lambda batch: (time.sleep(0.5), slow(batch)))
    career = new_career("SLO-WWW")
    started = time.monotonic()
    store.save(career)
    assert time.monotonic() - started < 0.1  # the request is free to go
    assert store.get("SLO-WWW") is career  # and every read sees the new state at once
    assert store.flush() and stored(store, "SLO-WWW")["code"] == "SLO-WWW"


def test_a_failed_write_is_retried_until_it_lands(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "RETRY_SECONDS", (0.01,))
    store = CareerStore(str(tmp_path / "c.db"))
    real, calls = store._write, []

    def flaky(batch):
        calls.append(dict(batch))
        if len(calls) < 3:
            raise ConnectionError("Neon blinked")
        real(batch)

    monkeypatch.setattr(store, "_write", flaky)
    career = new_career("RET-RYY")
    store.save(career)
    assert store.flush(5) and len(calls) >= 3
    assert stored(store, "RET-RYY")["code"] == "RET-RYY"


def test_saves_of_one_career_collapse_and_the_newest_wins(tmp_path):
    store = CareerStore(str(tmp_path / "c.db"))
    career = new_career("NEW-EST")
    for year in range(1, 6):
        store.save(career.model_copy(update={"year": year}))
    assert store.flush() and stored(store, "NEW-EST")["year"] == 5


def test_the_cache_is_bounded_but_never_drops_an_unwritten_career(tmp_path, monkeypatch):
    store = CareerStore(str(tmp_path / "c.db"), cache_size=3)
    for i in range(10):
        store.save(new_career(f"CAC-HE{'ABCDEFGHJK'[i]}"))
    assert store.flush()
    store.save(new_career("CAC-HEZ"))
    assert store.flush() and len(store._cache) <= 3
    assert store.get("CAC-HEA").code == "CAC-HEA"  # evicted ones reload from the database


def test_a_restart_finds_every_career_after_a_graceful_shutdown(tmp_path):
    first = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                                  careers=CareerStore(str(tmp_path / "t.db"))))
    with first:  # the context runs startup and shutdown, and shutdown flushes
        code = first.post("/api/career").json()["code"]
        first.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    again = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                                  careers=CareerStore(str(tmp_path / "t.db"))))
    assert again.get(f"/api/career/{code}").json()["status"] == "contract"


# ── rules the API now enforces ────────────────────────────────────────────────────

def test_retiring_twice_hands_back_the_same_fresh_career(client):
    old = client.post("/api/career").json()["code"]
    fresh = client.post(f"/api/career/{old}/retire").json()["code"]
    assert client.post(f"/api/career/{old}/retire").json()["code"] == fresh
    assert client.get(f"/api/career/{fresh}").json()["status"] == "offers"


def test_a_retired_career_cannot_be_brought_back_by_accusing(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    meta = client.post(f"/api/career/{code}/case").json()
    summary = client.get(f"/api/cases/{meta['case_id']}/state").json()["results"][0]["result_id"]
    client.post(f"/api/career/{code}/retire")
    res = client.post(f"/api/career/cases/{meta['case_id']}/accuse", json={"accusations": [{
        "suspect_id": "E1", "theory": "weekend", "evidence_ids": [summary],
        "exhibits": rows_of(client, meta["case_id"], "E1")[:1]}]})
    assert res.status_code == 409
    assert client.get(f"/api/career/{code}").json()["status"] == "retired"
    assert client.post(f"/api/career/{code}/case").status_code == 409


def test_a_case_from_an_old_contract_cannot_be_scored_into_a_new_one(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    stale = client.post(f"/api/career/{code}/case").json()
    for _ in range(5):
        play_case(app, client, code)  # the contract ends; stale was its first case
    session = app.state.store.get(stale["case_id"])
    session.career_verdict = None  # pretend it was never accused
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi", "practice": True})
    summary = next(iter(session.results))
    res = client.post(f"/api/career/cases/{stale['case_id']}/accuse", json={"accusations": [{
        "suspect_id": "E1", "theory": "weekend", "evidence_ids": [summary],
        "exhibits": rows_of(client, stale["case_id"], "E1")[:1]}]})
    assert res.status_code == 409


def test_guessing_career_codes_is_rate_limited(tmp_path):
    client = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                                   careers=CareerStore(str(tmp_path / "t.db"))))
    code = client.post("/api/career").json()["code"]
    statuses = [client.get(f"/api/career/ZZZ-{n:03d}").status_code for n in range(40)]
    assert statuses[0] == 404 and statuses[-1] == 429
    assert client.get(f"/api/career/{code}").status_code == 200  # real codes still open


def test_creating_careers_is_rate_limited(tmp_path):
    client = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                                   careers=CareerStore(str(tmp_path / "t.db")), rate_limit=3))
    assert [client.post("/api/career").status_code for _ in range(4)] == [200, 200, 200, 429]


def test_oversized_accusations_are_refused_before_any_work(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    meta = client.post(f"/api/career/{code}/case").json()
    res = client.post(f"/api/career/cases/{meta['case_id']}/accuse", json={"accusations": [{
        "suspect_id": "E1", "theory": "weekend", "evidence_ids": ["x"],
        "exhibits": ["T" * 100_000]}]})
    assert res.status_code == 422


def test_what_catches_it_matches_the_tools_that_prove_each_trick(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    verdict = play_case(app, client, code)
    view = client.get(f"/api/career/{code}").json()
    fits = {t["id"]: [f["tool"] for f in t["fits"]] for t in view["theories"]}
    for culprit in verdict["culprits"]:
        assert culprit["catching_tools"]
        assert set(culprit["catching_tools"]) <= set(fits[culprit["scheme"]])


# ── the Final's lineup and two-culprit cases ──────────────────────────────────────

def final_case(index: int = 0):
    career = new_career("FIN-ALL")
    career.offers, career.tier = ["kaveri"], "very_large"
    sign(career, "kaveri")
    record = career.contract.cases[index]
    plan = CasePlan("kaveri", record.index, record.difficulty, tuple(record.schemes),
                    tuple(record.herrings), record.seed, record.forced_cameo)
    people = company_people("kaveri", career.contract.cameos)
    return build_career_case(plan, people, career.code, "case-final", 3)[0]


@pytest.mark.slow
def test_every_suspect_in_the_final_can_be_questioned(app, client):
    bundle = final_case()
    assert len(bundle.meta.suspects) >= 10
    lines = statements(bundle)
    assert set(lines) == {s.id for s in bundle.meta.suspects}
    for culprit in bundle.truth.culprits():  # both fraudsters lie about their own trick
        assert lines[culprit.fraudster_id] in THEMES[culprit.scheme]
    session = CaseSession(bundle=bundle, budget_left=bundle.meta.budget, started_at=0)
    app.state.store.create(session)
    for s in bundle.meta.suspects:
        assert client.get(f"/api/cases/case-final/interrogate/{s.id}").status_code == 200


@pytest.mark.slow
def test_twin_originals_and_the_fraudsters_weekends_are_fair_exhibits():
    for company, scheme in (("konkan", "duplicates"), ("sterling", "weekend")):
        career = new_career("EXH-IBT")
        career.offers = [company]
        sign(career, company)
        record = next(c for c in career.contract.cases if scheme in c.schemes)
        plan = CasePlan(company, record.index, record.difficulty, tuple(record.schemes),
                        tuple(record.herrings), record.seed, record.forced_cameo)
        bundle = build_career_case(plan, company_people(company, career.contract.cameos),
                                   career.code, "c", 5)[0]
        culprit = next(c for c in bundle.truth.culprits() if c.scheme == scheme)
        extra = telling_rows(bundle.df, culprit)
        mine = bundle.df[bundle.df["employee_id"] == culprit.fraudster_id]
        assert set(extra) <= set(mine["txn_id"]) and not set(extra) & set(culprit.fraud_txn_ids)
        if scheme == "duplicates":  # every copy has its original among the telling rows
            rows = mine.set_index("txn_id")
            originals = {(rows.at[t, "vendor"], rows.at[t, "amount"]) for t in extra}
            assert all((rows.at[t, "vendor"], rows.at[t, "amount"]) in originals
                       for t in culprit.fraud_txn_ids)


# ── careers and their secrets ─────────────────────────────────────────────────────

def test_the_visible_code_does_not_decide_the_story():
    culprits = {new_career("SAM-EEE").final_culprit for _ in range(40)}
    assert len(culprits) > 1  # a hidden salt, not the code, picks who did it
    a, b = new_career("SAM-EEE", salt="x"), new_career("SAM-EEE", salt="x")
    assert a.final_culprit == b.final_culprit  # but a career is consistent with itself
    for c in (a, b):
        c.offers = ["lakshmi"]
        sign(c, "lakshmi")
    assert [r.seed for r in a.contract.cases] == [r.seed for r in b.contract.cases]


def test_the_salt_never_leaves_the_server(client):
    view = client.post("/api/career").text
    assert "salt" not in view and "successor" not in view


def test_careers_saved_before_the_new_rating_still_load_and_play(app, client):
    old = new_career("OLD-AAA", salt="")
    old.offers = ["lakshmi"]
    sign(old, "lakshmi")
    state = json.loads(old.model_dump_json())
    for key in ("salt", "successor"):
        state.pop(key)
    for case in state["contract"]["cases"][:1]:  # one case scored the old way
        case["rating"] = {"total": 81.0, "verdict": 40, "evidence": 20, "judgment": 12,
                          "efficiency": 9, "caught": 1, "culprits": 1}
        case["correct"] = True
    with app.state.careers._engine.begin() as conn:
        conn.execute(careers.insert().values(code="OLD-AAA", state=json.dumps(state), updated=0))
    view = client.get("/api/career/OLD-AAA").json()
    assert view["contract"]["cases"][0]["rating"] == 81.0
    verdict = play_case(app, client, "OLD-AAA")  # the next case plays on the new rating
    assert verdict["rating"]["parts"] and verdict["progress"]["index"] == 2


def test_firing_clears_every_promotion_streak():
    career = new_career("FIR-EDD")
    career.offers, career.tier = ["vasundhara"], "very_large"
    career.mid_good = ["a", "b"]
    career.large_exceptional = ["x", "y"]
    career.companies["meridian"] = CompanyRecord(goods=2)  # two Good years at a large firm
    for _ in range(2):
        if career.status != "contract":
            if "vasundhara" not in career.offers:
                career.offers.append("vasundhara")
            sign(career, "vasundhara")
        finish(career, "bad")
    assert career.tier == "large"
    assert career.mid_good == [] and career.large_exceptional == [] and career.vl_exceptional == []
    assert all(r.goods == 0 for r in career.companies.values())


def test_a_closed_case_cannot_be_recorded_twice():
    career = new_career("TWI-CEE")
    career.offers = ["lakshmi"]
    sign(career, "lakshmi")
    record_case(career, 0, CaseRating(total=90, caught=1, culprits=1), [])
    with pytest.raises(CareerError):
        record_case(career, 0, CaseRating(total=10, caught=0, culprits=1), [])


# ── memory ────────────────────────────────────────────────────────────────────────

def quick_session(seed: int, solved: bool = False) -> CaseSession:
    bundle = build_case(1, seed)
    session = CaseSession(bundle=bundle, budget_left=1, started_at=0)
    if solved:
        session.career_verdict = object()
    return session


def test_solved_cases_expire_sooner_than_open_ones():
    now = [0.0]
    store = SessionStore(ttl_seconds=600, solved_ttl_seconds=60, clock=lambda: now[0])
    solved, open_ = quick_session(1, solved=True), quick_session(2)
    store.create(solved)
    store.create(open_)
    now[0] = 120
    store.create(quick_session(3))
    with pytest.raises(KeyError):
        store.get(solved.case_id)
    assert store.get(open_.case_id) is open_


def test_the_store_is_bounded_by_rows_and_drops_solved_cases_first():
    one = len(quick_session(1).bundle.df)
    store = SessionStore(max_rows=int(one * 3.5))
    playing, done, also_playing = quick_session(1), quick_session(2, solved=True), quick_session(3)
    for s in (playing, done, also_playing):
        store.create(s)
    store.create(quick_session(4))  # one too many: the solved case makes room
    with pytest.raises(KeyError):
        store.get(done.case_id)
    assert store.get(playing.case_id) and store.get(also_playing.case_id)
    assert store.rows <= store.max_rows
    store.create(quick_session(5))  # nothing solved left: the least recently used goes
    assert store.rows <= store.max_rows and len(store._sessions) == 3


def test_a_rebuilt_case_is_not_counted_twice():
    store = SessionStore()
    first = quick_session(1)
    store.create(first)
    rows = store.rows
    store.create(CaseSession(bundle=first.bundle, budget_left=1, started_at=0))
    assert store.rows == rows
