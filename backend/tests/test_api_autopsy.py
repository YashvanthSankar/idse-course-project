from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


def test_autopsy_and_profile_routes(tmp_path):
    telemetry = Telemetry(str(tmp_path / "a.db"))
    client = TestClient(create_app(store=SessionStore(), telemetry=telemetry))
    code = client.post("/api/rooms").json()["code"]
    assert client.get(f"/api/rooms/{code}/autopsy").json()["slides"][0]["title"] == \
        "No detectives yet"
    cid = client.post("/api/cases", json={"level": 1, "seed": 1, "player_id": "P1"}).json()[
        "case_id"]
    client.post(f"/api/cases/{cid}/tools/zscore", json={"params": {}})
    profile = client.get("/api/players/P1/profile").json()
    assert profile["archetype"] and profile["radar_figure"]["data"]
    assert client.get("/api/players/ghost/profile").status_code == 404
    assert client.get("/api/rooms/ZZZZ/autopsy").status_code == 404
