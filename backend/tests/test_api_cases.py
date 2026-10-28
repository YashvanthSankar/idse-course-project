import json

import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry

TRUTH_MARKERS = ["fraudster_id", "fraud_txn_ids", "catching_tools", "is_fraud", "big_invoice",
                 "herrings", "explanation"]


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db"))))


def new_case(client, level=1, seed=3):
    res = client.post("/api/cases", json={"level": level, "seed": seed})
    assert res.status_code == 200
    return res.json()


def test_levels(client):
    levels = client.get("/api/levels").json()
    assert [lv["level"] for lv in levels] == list(range(1, 8))
    assert {"title", "teaser", "budget", "difficulty"} <= set(levels[0])


def test_create_case_returns_meta(client):
    meta = new_case(client)
    assert meta["budget_left"] == 8 and len(meta["suspects"]) == 5
    assert len(meta["case_id"]) == 12


def test_get_case(client):
    meta = new_case(client)
    again = client.get(f"/api/cases/{meta['case_id']}").json()
    assert again == meta


def test_rows_paging(client):
    meta = new_case(client)
    page = client.get(f"/api/cases/{meta['case_id']}/rows?offset=0&limit=50").json()
    assert len(page["rows"]) == 50 and page["total"] == meta["n_rows"]
    assert set(page["rows"][0]) == set(meta["columns"])
    tail = client.get(f"/api/cases/{meta['case_id']}/rows?offset={meta['n_rows'] - 5}&limit=50")
    assert len(tail.json()["rows"]) == 5


def test_tools_list_marks_locks(client):
    specs = {t["id"]: t for t in client.get("/api/tools?level=1").json()}
    assert specs["zscore"]["unlocked"] and not specs["benford"]["unlocked"]
    assert len(specs) == 9


def test_tool_run_charges_budget(client):
    cid = new_case(client)["case_id"]
    res = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    assert res["cost_charged"] == 2 and res["budget_left"] == 6
    assert res["params"] == {"scope": "per_employee", "threshold": 3.0}
    assert res["code"].startswith("def analyze")
    assert res["figure"]["data"]
    assert client.get(f"/api/cases/{cid}").json()["budget_left"] == 6


def test_cached_rerun_is_free(client):
    cid = new_case(client)["case_id"]
    a = client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}}).json()
    b = client.post(f"/api/cases/{cid}/tools/zscore",
                    json={"params": {"scope": "per_employee"}}).json()
    assert b["cost_charged"] == 0 and b["result_id"] == a["result_id"] and b["budget_left"] == 6


def test_over_budget_409(client):
    cid = new_case(client)["case_id"]  # budget 8
    for scope in ("per_employee", "global"):
        client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {"scope": scope}})
    client.post(f"/api/cases/{cid}/tools/iqr_box", json={"params": {}})  # 6 spent
    client.post(f"/api/cases/{cid}/tools/summary", json={"params": {}})  # 7 spent
    res = client.post(f"/api/cases/{cid}/tools/zscore",
                      json={"params": {"scope": "global", "threshold": 2.5}})
    assert res.status_code == 409 and res.json() == {"detail": "Out of budget"}
    assert client.get(f"/api/cases/{cid}").json()["budget_left"] == 1


def test_locked_tool_403(client):
    cid = new_case(client)["case_id"]
    assert client.post(f"/api/cases/{cid}/tools/benford", json={"params": {}}).status_code == 403


def test_bad_params_422(client):
    cid = new_case(client)["case_id"]
    res = client.post(f"/api/cases/{cid}/tools/groupby", json={"params": {"by": "colour"}})
    assert res.status_code == 422
    assert client.get(f"/api/cases/{cid}").json()["budget_left"] == 8


def test_unknown_tool_422(client):
    cid = new_case(client)["case_id"]
    assert client.post(f"/api/cases/{cid}/tools/crystal_ball", json={}).status_code == 422


def test_no_truth_leak(client):
    meta = new_case(client, level=1, seed=5)
    cid = meta["case_id"]
    bodies = [json.dumps(meta), client.get(f"/api/cases/{cid}").text,
              client.get(f"/api/cases/{cid}/rows?limit=2000").text,
              client.get(f"/api/cases/{cid}/data.csv").text, client.get("/api/tools?level=1").text]
    for tool in ("summary", "groupby", "zscore", "iqr_box"):
        bodies.append(client.post(f"/api/cases/{cid}/tools/{tool}", json={"params": {}}).text)
    for body in bodies:
        for marker in TRUTH_MARKERS:
            assert marker not in body


def test_csv_download(client):
    meta = new_case(client)
    res = client.get(f"/api/cases/{meta['case_id']}/data.csv")
    assert res.headers["content-type"].startswith("text/csv")
    lines = res.text.strip().splitlines()
    assert lines[0] == ",".join(meta["columns"]) and len(lines) == meta["n_rows"] + 1


def test_hacker_charge(client):
    cid = new_case(client)["case_id"]
    assert client.post(f"/api/cases/{cid}/hacker-charge").json() == {"budget_left": 7}
    for _ in range(7):
        client.post(f"/api/cases/{cid}/hacker-charge")
    assert client.post(f"/api/cases/{cid}/hacker-charge").status_code == 409


def test_unknown_case_404(client):
    assert client.get("/api/cases/nope").status_code == 404
    assert client.post("/api/cases/nope/tools/summary", json={}).status_code == 404


def test_invalid_level_422(client):
    assert client.post("/api/cases", json={"level": 9}).status_code == 422


def test_store_evicts_oldest(tmp_path):
    store = SessionStore(max_size=2)
    c = TestClient(create_app(store=store, telemetry=Telemetry(str(tmp_path / "e.db"))))
    ids = [new_case(c, seed=s)["case_id"] for s in range(3)]
    assert c.get(f"/api/cases/{ids[0]}").status_code == 404
    assert c.get(f"/api/cases/{ids[2]}").status_code == 200
