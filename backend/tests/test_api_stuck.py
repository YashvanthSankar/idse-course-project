"""A player who runs out of budget with fewer than two clues must still be able to accuse."""

import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    return TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "k.db"))))


def new_case(client):
    return client.post("/api/cases", json={"level": 1, "seed": 6}).json()["case_id"]


def test_broke_with_no_clues_can_accuse_empty_handed(client):
    cid = new_case(client)
    for _ in range(5):
        client.post(f"/api/cases/{cid}/hacker-charge")
    truth = client.get(f"/api/debug/cases/{cid}/truth").json()
    res = client.post(f"/api/cases/{cid}/accuse",
                      json={"suspect_id": truth["fraudster_id"], "evidence_ids": []})
    assert res.status_code == 200
    v = res.json()
    assert v["correct"] and v["breakdown"]["evidence"] == 0 and v["evidence"] == []


def test_broke_with_one_clue_must_use_it(client):
    cid = new_case(client)
    r1 = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    for _ in range(3):
        client.post(f"/api/cases/{cid}/hacker-charge")
    assert client.post(f"/api/cases/{cid}/accuse",
                       json={"suspect_id": "E1", "evidence_ids": []}).status_code == 422
    assert client.post(f"/api/cases/{cid}/accuse", json={
        "suspect_id": "E1", "evidence_ids": [r1["result_id"]]}).status_code == 200


def test_with_budget_left_two_clues_are_required(client):
    cid = new_case(client)
    r1 = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    res = client.post(f"/api/cases/{cid}/accuse",
                      json={"suspect_id": "E1", "evidence_ids": [r1["result_id"]]})
    assert res.status_code == 422
    assert "two" in res.json()["detail"].lower()
