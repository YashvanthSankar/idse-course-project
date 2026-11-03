"""Regression tests for the final code review findings (C1, I1-I3, I5-I7)."""

import asyncio

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from auditor.api import create_app
from auditor.autopsy import build_autopsy
from auditor.generator.cases import build_case
from auditor.models import Verdict
from auditor.rooms import RoomManager
from auditor.store import CaseSession, SessionStore
from auditor.telemetry import Telemetry
from tests.fixtures import synthetic_events

COLS = ["ts", "type", "player_id", "case_id", "room_code", "tool_id", "payload"]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_DEBUG", "1")
    return TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "f.db"))))


def manager(tmp_path, wall=lambda: 1000.0, store=None):
    return RoomManager(store or SessionStore(), Telemetry(str(tmp_path / "m.db")), clock=lambda: 0.0,
                       wall=wall)


def verdict(correct=True, score=1200):
    case = build_case(1, 0)
    return Verdict(correct=correct, score=score, breakdown={}, fraudster=case.meta.suspects[0],
                   scheme="big_invoice", explanation="", fraud_txn_ids=[], catching_tools=[],
                   evidence=[])


# ---- C1: only the session that created the room may act as its host -------------

def test_create_room_returns_host_token(client):
    body = client.post("/api/rooms").json()
    assert len(body["host_token"]) >= 16


@pytest.mark.parametrize("suffix", ["", "&token=wrong"])
def test_host_without_valid_token_rejected(client, suffix):
    code = client.post("/api/rooms").json()["code"]
    with client.websocket_connect(f"/ws/rooms/{code}?role=host{suffix}") as ws, \
            pytest.raises(WebSocketDisconnect) as closed:
        ws.receive_json()
    assert closed.value.code == 4403


def test_host_with_token_accepted(client):
    room = client.post("/api/rooms").json()
    with client.websocket_connect(f"/ws/rooms/{room['code']}?role=host&token={room['host_token']}") as ws:
        assert ws.receive_json()["type"] == "lobby"


# ---- I1: the autopsy never crashes on small or odd classes ----------------------

def _events(rows):
    return pd.DataFrame(rows, columns=COLS)


def test_autopsy_single_player():
    events = _events([
        (0, "case_started", "P1", "C1", "R", None, {"level": 1}),
        (1, "tool_run", "P1", "C1", "R", "zscore", {"cost": 2, "visual": True}),
        (2, "accused", "P1", "C1", "R", None, {"correct": True, "score": 900, "elapsed_s": 40}),
    ])
    assert len(build_autopsy(events)) == 6


def test_autopsy_nobody_accused():
    rows = [(0, "case_started", f"P{i}", f"C{i}", "R", None, {"level": 1}) for i in range(9)]
    rows += [(1, "tool_run", f"P{i}", f"C{i}", "R", "summary", {"cost": 1}) for i in range(9)]
    assert len(build_autopsy(_events(rows))) == 6


def test_autopsy_identical_players():
    rows = [(0, "case_started", f"P{i}", f"C{i}", "R", None, {"level": 1}) for i in range(10)]
    assert len(build_autopsy(_events(rows))) == 6


# ---- I2: a second round is analysed on its own -----------------------------------

def test_autopsy_uses_latest_round():
    rows = []
    for i in range(10):
        rows += [(0, "case_started", f"P{i}", f"A{i}", "R", None, {"level": 1}),
                 (1, "accused", f"P{i}", f"A{i}", "R", None, {"correct": False, "score": 0,
                                                             "elapsed_s": 50}),
                 (2, "case_started", f"P{i}", f"B{i}", "R", None, {"level": 1}),
                 (3, "accused", f"P{i}", f"B{i}", "R", None, {"correct": True, "score": 1000,
                                                             "elapsed_s": 60})]
    assert build_autopsy(_events(rows))[0].stats["solve_rate"] == 1.0


# ---- I3: the round ends on time, server-side, and late verdicts don't count -----

def _room_with_player(rooms):
    code = rooms.create()
    rooms.join(code, "p1", "Asha")
    rooms.start(code, 1, 60)
    return code, rooms.store.get(rooms.rooms[code].players["p1"].case_id)


def test_verdict_after_end_not_recorded(tmp_path):
    rooms = manager(tmp_path)
    code, session = _room_with_player(rooms)
    rooms.end(code)
    assert rooms.record_verdict(session, verdict()) is False
    assert rooms.leaderboard(code)["solved"] == 0


def test_verdict_after_deadline_not_recorded(tmp_path):
    now = [1000.0]
    rooms = manager(tmp_path, wall=lambda: now[0])
    code, session = _room_with_player(rooms)
    now[0] += 60 + 30  # past the deadline and the grace period
    assert rooms.record_verdict(session, verdict()) is False
    assert rooms.rooms[code].status == "ended"


def test_server_ends_round_on_its_own(tmp_path):
    rooms = manager(tmp_path)
    code, _ = _room_with_player(rooms)
    asyncio.run(rooms.end_after(code, rooms.rooms[code].round, delay=0.01))
    assert rooms.rooms[code].status == "ended"


def test_stale_timer_does_not_end_a_newer_round(tmp_path):
    rooms = manager(tmp_path)
    code, _ = _room_with_player(rooms)
    old_round = rooms.rooms[code].round
    rooms.start(code, 2, 60)
    asyncio.run(rooms.end_after(code, old_round, delay=0.01))
    assert rooms.rooms[code].status == "running"


# ---- I5: memory stays bounded and a live class can't be evicted ------------------

def test_live_room_sessions_survive_eviction(tmp_path):
    store = SessionStore(max_size=2)
    rooms = manager(tmp_path, store=store)
    store.protect = lambda s: rooms.is_live(s.room_code)
    _, session = _room_with_player(rooms)
    for seed in range(3):
        bundle = build_case(1, seed, case_id=f"solo{seed}")
        store.create(CaseSession(bundle=bundle, budget_left=8, started_at=0))
    assert store.get(session.case_id) is session


def test_idle_sessions_expire():
    now = [0.0]
    store = SessionStore(ttl_seconds=100, clock=lambda: now[0])
    store.create(CaseSession(bundle=build_case(1, 0, case_id="old"), budget_left=8, started_at=0))
    now[0] = 500
    store.create(CaseSession(bundle=build_case(1, 1, case_id="new"), budget_left=8, started_at=0))
    with pytest.raises(KeyError):
        store.get("old")


def test_case_creation_is_rate_limited(tmp_path):
    c = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "r.db")),
                              rate_limit=3))
    codes = [c.post("/api/cases", json={"level": 1, "seed": s}).status_code for s in range(4)]
    assert codes == [200, 200, 200, 429]
    assert c.post("/api/rooms").status_code == 200  # separate bucket


def test_old_rooms_expire(tmp_path):
    now = [0.0]
    rooms = manager(tmp_path, wall=lambda: now[0])
    old = rooms.create()
    now[0] = 13 * 3600
    rooms.create()
    assert old not in rooms.rooms


# ---- I6: the autopsy uses an exact test for 2x2 tables --------------------------

def test_predictive_tool_uses_exact_test():
    rows = []
    for i in range(12):
        used = i < 6
        rows.append((0, "case_started", f"P{i}", f"C{i}", "R", None, {"level": 1}))
        if used:
            rows.append((1, "tool_run", f"P{i}", f"C{i}", "R", "benford", {"cost": 3}))
        else:
            rows.append((1, "tool_run", f"P{i}", f"C{i}", "R", "summary", {"cost": 1}))
        rows.append((2, "accused", f"P{i}", f"C{i}", "R", None,
                     {"correct": used, "score": 1000 * used, "elapsed_s": 30}))
    stats = build_autopsy(_events(rows))[4].stats
    assert stats["best_tool"] in {"Benford's Law", "Case Summary"} and stats["best_p"] < 0.05


# ---- I7: a phone joining during START can't break the round ---------------------

def test_join_during_start_is_safe(tmp_path, monkeypatch):
    rooms = manager(tmp_path)
    code = rooms.create()
    rooms.join(code, "p1", "Asha")
    original = rooms.ensure_case

    def joining_mid_start(c, pid):
        if pid == "p1":
            rooms.join(c, "late", "Late")
        return original(c, pid)

    monkeypatch.setattr(rooms, "ensure_case", joining_mid_start)
    assignments = rooms.start(code, 1, 60)
    assert "p1" in assignments


def test_synthetic_class_still_works():
    assert len(build_autopsy(synthetic_events(50, seed=2))) == 6
