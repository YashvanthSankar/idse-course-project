import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    clock = Clock()
    telemetry = Telemetry(str(tmp_path / "a.db"))
    client = TestClient(create_app(store=SessionStore(), telemetry=telemetry, clock=clock))
    return client, telemetry, clock


def solve_level1(client, clock, elapsed=100):
    cid = client.post("/api/cases", json={"level": 1, "seed": 4, "player_id": "P9"}).json()[
        "case_id"]
    truth = client.get(f"/api/debug/cases/{cid}/truth").json()
    r1 = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    r2 = client.post(f"/api/cases/{cid}/tools/iqr_box", json={"params": {}}).json()
    clock.now += elapsed
    return cid, truth, r1, r2


def test_accuse_correct_flow(env):
    client, _, clock = env
    cid, truth, r1, r2 = solve_level1(client, clock)
    v = client.post(f"/api/cases/{cid}/accuse", json={
        "suspect_id": truth["fraudster_id"], "evidence_ids": [r1["result_id"], r2["result_id"]]
    }).json()
    assert v["correct"] and v["score"] == 1000 + 500 + 20 * 4 + 250
    assert [g["grade"] for g in v["evidence"]] == ["strong", "strong"]
    assert v["reveal_figure"]["data"]


def test_accuse_idempotent(env):
    client, _, clock = env
    cid, truth, r1, r2 = solve_level1(client, clock)
    ids = [r1["result_id"], r2["result_id"]]
    first = client.post(f"/api/cases/{cid}/accuse",
                        json={"suspect_id": truth["fraudster_id"], "evidence_ids": ids}).json()
    other = next(s for s in ("E1", "E2", "E3", "E4", "E5") if s != truth["fraudster_id"])
    second = client.post(f"/api/cases/{cid}/accuse", json={"suspect_id": other,
                                                         "evidence_ids": ids}).json()
    assert second == first


def test_accuse_unknown_evidence_422(env):
    client, _, clock = env
    cid, _truth, r1, _ = solve_level1(client, clock)
    res = client.post(f"/api/cases/{cid}/accuse",
                      json={"suspect_id": "E1", "evidence_ids": [r1["result_id"], "fake"]})
    assert res.status_code == 422


def test_accuse_duplicate_evidence_422(env):
    client, _, clock = env
    cid, _, r1, _ = solve_level1(client, clock)
    res = client.post(f"/api/cases/{cid}/accuse",
                      json={"suspect_id": "E1", "evidence_ids": [r1["result_id"]] * 2})
    assert res.status_code == 422


def test_accuse_unknown_suspect_422(env):
    client, _, clock = env
    cid, _, r1, r2 = solve_level1(client, clock)
    res = client.post(f"/api/cases/{cid}/accuse", json={
        "suspect_id": "E9", "evidence_ids": [r1["result_id"], r2["result_id"]]})
    assert res.status_code == 422


def test_accuse_needs_two_evidence(env):
    client, _, clock = env
    cid, _, r1, _ = solve_level1(client, clock)
    res = client.post(f"/api/cases/{cid}/accuse",
                      json={"suspect_id": "E1", "evidence_ids": [r1["result_id"]]})
    assert res.status_code == 422


def test_debug_truth_hidden_by_default(tmp_path, monkeypatch):
    monkeypatch.delenv("AUDITOR_DEBUG", raising=False)
    client = TestClient(create_app(store=SessionStore(),
                                   telemetry=Telemetry(str(tmp_path / "x.db"))))
    cid = client.post("/api/cases", json={"level": 1, "seed": 1}).json()["case_id"]
    assert client.get(f"/api/debug/cases/{cid}/truth").status_code == 404


def test_events_logged(env):
    client, telemetry, clock = env
    cid, truth, r1, r2 = solve_level1(client, clock, elapsed=42)
    client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}})  # cached: not logged
    client.post(f"/api/cases/{cid}/accuse", json={
        "suspect_id": truth["fraudster_id"], "evidence_ids": [r1["result_id"], r2["result_id"]]})
    events = telemetry.events_df()
    assert events["type"].tolist() == ["case_started", "tool_run", "tool_run", "accused"]
    assert events["player_id"].unique().tolist() == ["P9"]
    accused = events.iloc[-1]["payload"]
    assert accused["correct"] is True and accused["elapsed_s"] == 42
    assert {"score", "budget_left", "accused", "level"} <= set(accused)


def test_verdict_hook_called(env):
    client, _, clock = env
    seen = []
    client.app.state.on_verdict.append(lambda session, verdict: seen.append(verdict.correct))
    cid, truth, r1, r2 = solve_level1(client, clock)
    body = {"suspect_id": truth["fraudster_id"], "evidence_ids": [r1["result_id"], r2["result_id"]]}
    client.post(f"/api/cases/{cid}/accuse", json=body)
    client.post(f"/api/cases/{cid}/accuse", json=body)
    assert seen == [True]
