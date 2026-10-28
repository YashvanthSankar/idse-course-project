from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


def test_state_restores_results_and_verdict(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    client = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "s.db"))))
    cid = client.post("/api/cases", json={"level": 1, "seed": 5}).json()["case_id"]
    empty = client.get(f"/api/cases/{cid}/state").json()
    assert empty["results"] == [] and empty["verdict"] is None and empty["meta"]["budget_left"] == 5

    r1 = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    r2 = client.post(f"/api/cases/{cid}/tools/iqr_box", json={"params": {}}).json()
    state = client.get(f"/api/cases/{cid}/state").json()
    assert [r["result_id"] for r in state["results"]] == [r1["result_id"], r2["result_id"]]
    assert state["meta"]["budget_left"] == 1

    truth = client.get(f"/api/debug/cases/{cid}/truth").json()
    verdict = client.post(f"/api/cases/{cid}/accuse", json={
        "suspect_id": truth["fraudster_id"], "evidence_ids": [r1["result_id"], r2["result_id"]]}).json()
    assert client.get(f"/api/cases/{cid}/state").json()["verdict"] == verdict


def test_state_unknown_case_404(tmp_path):
    client = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "s.db"))))
    assert client.get("/api/cases/nope/state").status_code == 404
