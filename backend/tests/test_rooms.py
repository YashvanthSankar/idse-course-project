import pandas as pd
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from auditor.api import create_app
from auditor.rooms import CODE_ALPHABET
from auditor.store import SessionStore
from auditor.telemetry import Telemetry


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    return TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "r.db"))))


def room(client):
    return client.post("/api/rooms").json()["code"]


def until(ws, kind, where=lambda m: True, limit=40):
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == kind and where(msg):
            return msg
    raise AssertionError(f"never received {kind}")


def player_url(code, pid, name):
    return f"/ws/rooms/{code}?role=player&player_id={pid}&name={name}"


def solve(client, case_id, correct=True):
    truth = client.get(f"/api/debug/cases/{case_id}/truth").json()
    meta = client.get(f"/api/cases/{case_id}").json()
    tool = meta["unlocked_tools"]
    r1 = client.post(f"/api/cases/{case_id}/tools/zscore", json={"params": {}}).json()
    r2 = client.post(f"/api/cases/{case_id}/tools/{tool[3]}", json={"params": {}}).json()
    suspect = truth["fraudster_id"] if correct else next(
        s["id"] for s in meta["suspects"] if s["id"] != truth["fraudster_id"])
    return client.post(f"/api/cases/{case_id}/accuse", json={
        "suspect_id": suspect, "evidence_ids": [r1["result_id"], r2["result_id"]]}).json()


def test_room_code_format(client):
    code = room(client)
    assert len(code) == 4 and set(code) <= set(CODE_ALPHABET)
    assert "I" not in CODE_ALPHABET and "O" not in CODE_ALPHABET


def test_unknown_room_rejected(client):
    with pytest.raises(WebSocketDisconnect), \
            client.websocket_connect("/ws/rooms/ZZZZ?role=host") as ws:
        ws.receive_json()


def test_join_broadcasts_lobby(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host:
        assert until(host, "lobby")["players"] == []
        with client.websocket_connect(player_url(code, "p1", "Asha")):
            assert [p["name"] for p in until(host, "lobby")["players"]] == ["Asha"]
            with client.websocket_connect(player_url(code, "p2", "Bilal")):
                lobby = until(host, "lobby", lambda m: len(m["players"]) == 2)
                assert sorted(p["name"] for p in lobby["players"]) == ["Asha", "Bilal"]


def test_start_gives_same_case_to_everyone(client):
    code = room(client)
    store = client.app.state.store
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a, \
            client.websocket_connect(player_url(code, "p2", "Bilal")) as b:
        host.send_json({"type": "start", "level": 2, "seconds": 300})
        start = until(host, "round_start")
        assert start["level"] == 2 and start["ends_at"] > 0
        case_a, case_b = until(a, "your_case")["case_id"], until(b, "your_case")["case_id"]
        assert case_a != case_b
        pd.testing.assert_frame_equal(store.get(case_a).bundle.df, store.get(case_b).bundle.df)
        assert store.get(case_a).room_code == code


def test_verdict_updates_leaderboard(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a, \
            client.websocket_connect(player_url(code, "p2", "Bilal")):
        host.send_json({"type": "start", "level": 1, "seconds": 300})
        case_id = until(a, "your_case")["case_id"]
        verdict = solve(client, case_id)
        board = until(host, "leaderboard", lambda m: m["solved"] == 1)
        assert board["total"] == 2
        assert board["top"][0]["name"] == "Asha"
        assert board["top"][0]["score"] == verdict["score"]
        assert until(host, "ticker")["text"]


def test_tool_runs_reach_ticker(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a:
        host.send_json({"type": "start", "level": 1, "seconds": 300})
        case_id = until(a, "your_case")["case_id"]
        client.post(f"/api/cases/{case_id}/tools/zscore", json={"params": {}})
        assert until(host, "ticker")["text"] == "Asha ran Z-Score Scan"


def test_reconnect_keeps_state(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host:
        with client.websocket_connect(player_url(code, "p1", "Asha")) as a:
            host.send_json({"type": "start", "level": 1, "seconds": 300})
            first = until(a, "your_case")["case_id"]
        with client.websocket_connect(player_url(code, "p1", "Asha")) as again:
            assert until(again, "your_case")["case_id"] == first
            lobby = until(host, "lobby", lambda m: m["players"] and m["players"][0]["connected"])
            assert [p["player_id"] for p in lobby["players"]] == ["p1"]


def test_double_accuse_counts_once(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a:
        host.send_json({"type": "start", "level": 1, "seconds": 300})
        case_id = until(a, "your_case")["case_id"]
        solve(client, case_id)
        until(host, "leaderboard", lambda m: m["solved"] == 1)
        solve(client, case_id)
    board = client.app.state.rooms.leaderboard(code)
    assert board["solved"] == 1 and len(board["top"]) == 1


def test_join_after_start_gets_case(client):
    code = room(client)
    store = client.app.state.store
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a:
        host.send_json({"type": "start", "level": 3, "seconds": 300})
        early = until(a, "your_case")["case_id"]
        with client.websocket_connect(player_url(code, "p9", "Late")) as late:
            msg = until(late, "your_case")
            pd.testing.assert_frame_equal(store.get(early).bundle.df,
                                          store.get(msg["case_id"]).bundle.df)


def test_end_round(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "Asha")) as a:
        host.send_json({"type": "start", "level": 1, "seconds": 300})
        until(a, "your_case")
        host.send_json({"type": "end"})
        assert until(a, "round_end")["type"] == "round_end"
        assert client.app.state.rooms.rooms[code].status == "ended"


def test_long_names_trimmed(client):
    code = room(client)
    with client.websocket_connect(f"/ws/rooms/{code}?role=host") as host, \
            client.websocket_connect(player_url(code, "p1", "X" * 40)):
        lobby = until(host, "lobby", lambda m: m["players"])
        assert lobby["players"][0]["name"] == "X" * 16
