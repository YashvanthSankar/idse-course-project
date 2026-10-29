"""Career Mode through the HTTP API, played by a bot that knows the truth."""

import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.career.cases import INTENDED
from auditor.career.storage import CareerStore
from auditor.store import SessionStore
from auditor.telemetry import Telemetry

PARAMS = {("under_limit", "groupby"): {"by": "vendor"}}
SECRETS = ["fraudster_id", "final_culprit", "seed", "schemes", "forced_cameo", "big_invoice",
           "fraud_txn_ids"]


@pytest.fixture
def app(tmp_path):
    return create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                      careers=CareerStore(str(tmp_path / "t.db")))


@pytest.fixture
def client(app):
    return TestClient(app)


def play_case(app, client, code: str, catch: bool = True, skip_cameo: bool = False) -> dict:
    """Open the current case, run each fraud's intended tool and accuse with two clues each."""
    meta = client.post(f"/api/career/{code}/case").json()
    session = app.state.store.get(meta["case_id"])
    culprits = session.bundle.truth.culprits()
    summary = next(iter(session.results))
    accusations, spare = [], [summary]
    for culprit in culprits:
        tool = next(t for t in INTENDED[culprit.scheme] if t in meta["unlocked_tools"])
        params = PARAMS.get((culprit.scheme, tool), {})
        res = client.post(f"/api/cases/{meta['case_id']}/tools/{tool}", json={"params": params})
        assert res.status_code == 200, res.text
        accusations.append({"suspect_id": culprit.fraudster_id,
                            "evidence_ids": [res.json()["result_id"]]})
    if len(culprits) == 2:  # four clues needed: buy one cheap extra look
        extra = client.post(f"/api/cases/{meta['case_id']}/tools/groupby",
                            json={"params": {"by": "category"}}).json()
        spare.append(extra["result_id"])
    for accusation, clue in zip(accusations, spare):
        accusation["evidence_ids"].append(clue)
    innocent = [s["id"] for s in meta["suspects"]
                if s["id"] not in {c.fraudster_id for c in culprits}]
    if not catch:
        accusations[0]["suspect_id"] = innocent[0]
    if skip_cameo:  # the Final: point at someone else instead of the old colleague
        for a in accusations:
            if session.lineup_cameos.get(a["suspect_id"]):
                a["suspect_id"] = next(i for i in innocent
                                       if i not in {x["suspect_id"] for x in accusations})
    res = client.post(f"/api/career/cases/{meta['case_id']}/accuse",
                      json={"accusations": accusations})
    assert res.status_code == 200, res.text
    return res.json()


def test_a_first_contract_end_to_end(app, client):
    career = client.post("/api/career", json={"player_id": "p1"}).json()
    code = career["code"]
    assert client.get(f"/api/career/{code.lower().replace('-', '')}").status_code == 200
    view = client.post(f"/api/career/{code}/sign", json={"company_id": "pixel"}).json()
    assert len(view["contract"]["greetings"]) == 3
    meta = client.post(f"/api/career/{code}/case").json()
    assert meta["career"]["index"] == 1 and meta["career"]["company"] == "Pixel Garage Studios"
    state = client.get(f"/api/cases/{meta['case_id']}/state").json()
    assert [r["tool_id"] for r in state["results"]] == ["summary"]  # free, automatic
    assert state["meta"]["budget_left"] == meta["budget"]
    # the same call returns the same open case
    assert client.post(f"/api/career/{code}/case").json()["case_id"] == meta["case_id"]

    verdicts = [play_case(app, client, code) for _ in range(5)]
    assert all(v["correct"] for v in verdicts)
    assert verdicts[0]["rating"]["total"] >= 88
    assert verdicts[0]["progress"]["index"] == 1 and verdicts[0]["appraisal"] is None
    appraisal = verdicts[-1]["appraisal"]
    assert appraisal["band"] in ("exceptional", "good")
    view = client.get(f"/api/career/{code}").json()
    assert view["status"] == "offers" and view["salary"] > 6
    assert any(o["tier"] == "mid" for o in view["offers"])
    assert view["history"][0]["company"] == "Pixel Garage Studios"


def test_one_shot_and_quick_accuse_refuses_career_cases(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    meta = client.post(f"/api/career/{code}/case").json()
    quick = client.post(f"/api/cases/{meta['case_id']}/accuse",
                        json={"suspect_id": "E1", "evidence_ids": []})
    assert quick.status_code == 409
    first = play_case(app, client, code)
    again = client.post(f"/api/career/cases/{meta['case_id']}/accuse",
                        json={"accusations": [{"suspect_id": "E1", "evidence_ids": []}]})
    assert again.json()["rating"] == first["rating"]


def test_accusations_are_checked(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "konkan"})
    meta = client.post(f"/api/career/{code}/case").json()
    url = f"/api/career/cases/{meta['case_id']}/accuse"
    summary = client.get(f"/api/cases/{meta['case_id']}/state").json()["results"][0]["result_id"]
    two = {"accusations": [{"suspect_id": "E1", "evidence_ids": [summary]},
                           {"suspect_id": "E2", "evidence_ids": []}]}
    assert client.post(url, json=two).status_code == 422  # one fraudster, one accusation
    one_clue = {"accusations": [{"suspect_id": "E1", "evidence_ids": [summary]}]}
    assert client.post(url, json=one_clue).status_code == 422  # two clues while you have coins


def test_views_never_leak_the_truth(app, client):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    meta = client.post(f"/api/career/{code}/case").text
    view = client.get(f"/api/career/{code}").text
    for secret in SECRETS:
        assert secret not in view and secret not in meta


def test_unknown_codes_and_bad_moves(client):
    assert client.get("/api/career/ZZZ-ZZZ").status_code == 404
    code = client.post("/api/career").json()["code"]
    assert client.post(f"/api/career/{code}/sign",
                       json={"company_id": "deccan"}).status_code == 409
    assert client.post(f"/api/career/{code}/case").status_code == 409


def test_retire_starts_a_fresh_career(client):
    old = client.post("/api/career", json={"player_id": "p9"}).json()["code"]
    fresh = client.post(f"/api/career/{old}/retire").json()
    assert fresh["code"] != old and fresh["status"] == "offers"
    assert client.get(f"/api/career/{old}").json()["status"] == "retired"


def test_a_server_restart_rebuilds_the_open_case(app, client, tmp_path):
    code = client.post("/api/career").json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "lakshmi"})
    meta = client.post(f"/api/career/{code}/case").json()
    fresh = TestClient(create_app(store=SessionStore(),
                                  telemetry=Telemetry(str(tmp_path / "t.db")),
                                  careers=CareerStore(str(tmp_path / "t.db"))))
    again = fresh.post(f"/api/career/{code}/case").json()
    assert again["case_id"] == meta["case_id"]
    assert [s["name"] for s in again["suspects"]] == [s["name"] for s in meta["suspects"]]


@pytest.mark.slow
@pytest.mark.parametrize("skip", [False, True])
def test_the_final_two_fraudsters_and_the_cutscene(app, client, skip):
    code = client.post("/api/career").json()["code"]
    # Put the career one step from the Final, with history for the cutscene
    careers: CareerStore = app.state.careers
    career = careers.get(code)
    career.offers, career.tier = ["kaveri"], "very_large"
    career.cameo_last = {"imran": "lakshmi", "tara": "deccan", "meher": "indus"}
    careers.save(career)
    client.post(f"/api/career/{code}/sign", json={"company_id": "kaveri"})
    verdicts = [play_case(app, client, code, skip_cameo=skip and i == 2) for i in range(3)]
    assert all(len(v["culprits"]) == 2 for v in verdicts)
    last = verdicts[-1]
    assert last["appraisal"] and last["cutscene"]
    assert last["cutscene"]["kind"] == ("escaped" if skip else "caught")
    assert last["cutscene"]["stops"][-1]["company"] == "The Kaveri Inquiry"
    view = client.get(f"/api/career/{code}").json()
    assert view["status"] == "ended" and view["ending"] == last["cutscene"]["kind"]
    assert client.get(f"/api/career/{code}/ending").status_code == 200


def test_debug_jump_is_off_unless_debugging(client, monkeypatch):
    code = client.post("/api/career").json()["code"]
    body = {"offers": ["vasundhara"], "tier": "very_large"}
    assert client.post(f"/api/career/{code}/debug-jump", json=body).status_code == 404
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    view = client.post(f"/api/career/{code}/debug-jump", json=body).json()
    assert [o["id"] for o in view["offers"]] == ["vasundhara"] and view["tier"] == "very_large"
