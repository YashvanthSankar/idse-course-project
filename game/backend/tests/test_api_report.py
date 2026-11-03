import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    return TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "r.db"))))


def test_report_409_before_verdict_then_pdf(client):
    cid = client.post("/api/cases", json={"level": 1, "seed": 2}).json()["case_id"]
    assert client.get(f"/api/cases/{cid}/report.pdf").status_code == 409
    truth = client.get(f"/api/debug/cases/{cid}/truth").json()
    ids = [client.post(f"/api/cases/{cid}/tools/{t}", json={"params": {}}).json()["result_id"]
           for t in ("zscore", "iqr_box")]
    client.post(f"/api/cases/{cid}/accuse",
                json={"suspect_id": truth["fraudster_id"], "evidence_ids": ids})
    res = client.get(f"/api/cases/{cid}/report.pdf")
    assert res.status_code == 200 and res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")


def test_level7_adapts(client):
    cid = client.post("/api/cases", json={"level": 1, "seed": 1, "player_id": "P"}).json()[
        "case_id"]
    for scope in ("per_employee", "global"):
        client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {"scope": scope}})
    client.post(f"/api/cases/{cid}/tools/iqr_box", json={"params": {}})
    for _ in range(10):
        new = client.post("/api/cases", json={"level": 7, "player_id": "P"}).json()["case_id"]
        assert client.get(f"/api/debug/cases/{new}/truth").json()["scheme"] != "big_invoice"
