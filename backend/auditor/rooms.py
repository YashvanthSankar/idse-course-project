"""Class Mode: a whole classroom plays the same case live, on their phones."""

import asyncio
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from fastapi import WebSocket

from auditor.generator.cases import CaseBundle, build_case
from auditor.models import Verdict
from auditor.store import CaseSession, SessionStore
from auditor.telemetry import Telemetry

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # no I or O: nobody squints at a projector
MAX_NAME = 16


@dataclass
class PlayerState:
    player_id: str
    name: str
    case_id: str | None = None
    score: int = 0
    solved: bool = False
    correct: bool = False
    connected: bool = True
    solved_at: float | None = None


@dataclass
class Room:
    code: str
    status: Literal["lobby", "running", "ended"] = "lobby"
    level: int = 1
    seed: int = 0
    ends_at: float | None = None  # epoch seconds
    started_at: float = 0.0  # monotonic clock, shared start line for every timer
    players: dict[str, PlayerState] = field(default_factory=dict)
    bundle: CaseBundle | None = None


class RoomManager:
    def __init__(self, store: SessionStore, telemetry: Telemetry, clock: Callable[[], float],
                 wall: Callable[[], float] = time.time):
        self.store, self.telemetry, self.clock, self.wall = store, telemetry, clock, wall
        self.rooms: dict[str, Room] = {}
        # socket -> (role, player_id, the event loop that owns the socket)
        self.sockets: dict[str, dict[WebSocket, tuple[str, str | None,
                                                      asyncio.AbstractEventLoop]]] = {}

    # ---- state ------------------------------------------------------------

    def create(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
            if code not in self.rooms:
                self.rooms[code] = Room(code=code)
                self.sockets[code] = {}
                return code

    def join(self, code: str, player_id: str, name: str) -> PlayerState:
        room = self.rooms[code]
        player = room.players.get(player_id)
        if player is None:
            clean = (name or "Detective").strip()[:MAX_NAME] or "Detective"
            player = room.players[player_id] = PlayerState(player_id=player_id, name=clean)
        player.connected = True
        return player

    def start(self, code: str, level: int, seconds: int) -> dict[str, str]:
        room = self.rooms[code]
        room.level, room.seed = level, secrets.randbelow(2**31)
        room.bundle = build_case(level, room.seed)
        room.status, room.started_at = "running", self.clock()
        room.ends_at = self.wall() + seconds
        for player in room.players.values():
            player.case_id, player.score, player.solved, player.correct = None, 0, False, False
        return {pid: self.ensure_case(code, pid) for pid in room.players}

    def ensure_case(self, code: str, player_id: str) -> str | None:
        """Give the player their copy of the round's case (late joiners included)."""
        room = self.rooms[code]
        player = room.players[player_id]
        if room.status != "running" or room.bundle is None:
            return None
        if player.case_id is None:
            case_id = SessionStore.new_id()
            # Everyone shares the read-only ledger; only the meta (case id) differs.
            bundle = CaseBundle(meta=room.bundle.meta.model_copy(update={"case_id": case_id}),
                                df=room.bundle.df, truth=room.bundle.truth)
            self.store.create(CaseSession(bundle=bundle, budget_left=bundle.meta.budget,
                                          started_at=room.started_at, player_id=player_id,
                                          room_code=code))
            self.telemetry.log("case_started", player_id=player_id, case_id=case_id,
                               room_code=code, payload={"level": room.level, "seed": room.seed})
            player.case_id = case_id
        return player.case_id

    def end(self, code: str) -> None:
        self.rooms[code].status = "ended"

    def record_verdict(self, session: CaseSession, verdict: Verdict) -> bool:
        room = self.rooms.get(session.room_code or "")
        player = room.players.get(session.player_id or "") if room else None
        if player is None or player.solved:
            return False
        player.solved, player.correct, player.score = True, verdict.correct, verdict.score
        player.solved_at = self.clock()
        self.broadcast_threadsafe(room.code, self.leaderboard(room.code))
        self.broadcast_threadsafe(room.code, {"type": "ticker",
                                              "text": f"{player.name} made an accusation"})
        return True

    def tool_ran(self, session: CaseSession, tool_name: str) -> None:
        room = self.rooms.get(session.room_code or "")
        player = room.players.get(session.player_id or "") if room else None
        if player is not None:
            self.broadcast_threadsafe(room.code, {"type": "ticker",
                                                  "text": f"{player.name} ran {tool_name}"})

    # ---- messages ---------------------------------------------------------

    def lobby(self, code: str) -> dict:
        room = self.rooms[code]
        return {"type": "lobby", "status": room.status, "players": [
            {"player_id": p.player_id, "name": p.name, "connected": p.connected,
             "solved": p.solved} for p in room.players.values()]}

    def leaderboard(self, code: str, top: int = 10) -> dict:
        room = self.rooms[code]
        ranked = sorted(room.players.values(),
                        key=lambda p: (-p.correct, -p.score, p.solved_at or float("inf")))
        return {"type": "leaderboard",
                "top": [{"rank": i + 1, "player_id": p.player_id, "name": p.name,
                         "score": p.score, "correct": p.correct, "solved": p.solved}
                        for i, p in enumerate(ranked[:top])],
                "solved": sum(p.solved for p in room.players.values()),
                "total": len(room.players)}

    def round_start(self, code: str) -> dict:
        room = self.rooms[code]
        return {"type": "round_start", "level": room.level,
                "ends_at": int((room.ends_at or 0) * 1000)}

    # ---- sockets ----------------------------------------------------------

    def add_socket(self, code: str, ws: WebSocket, role: str, player_id: str | None) -> None:
        self.sockets[code][ws] = (role, player_id, asyncio.get_running_loop())

    def remove_socket(self, code: str, ws: WebSocket) -> None:
        role, player_id, _ = self.sockets[code].pop(ws, ("host", None, None))
        if role == "player" and player_id:
            still_here = any(pid == player_id for _, pid, _ in self.sockets[code].values())
            self.rooms[code].players[player_id].connected = still_here

    async def broadcast(self, code: str, message: dict) -> None:
        for ws in list(self.sockets.get(code, {})):
            await self._send(code, ws, message)

    async def send_to_player(self, code: str, player_id: str, message: dict) -> None:
        for ws, (_, pid, _) in list(self.sockets.get(code, {}).items()):
            if pid == player_id:
                await self._send(code, ws, message)

    async def _send(self, code: str, ws: WebSocket, message: dict) -> None:
        entry = self.sockets.get(code, {}).get(ws)
        if entry is None:
            return
        owner = entry[2]
        try:
            if owner is asyncio.get_running_loop():
                await ws.send_json(message)
            else:  # the socket lives on another event loop: hand the send to that loop
                future = asyncio.run_coroutine_threadsafe(ws.send_json(message), owner)
                await asyncio.wrap_future(future)
        except Exception:  # noqa: BLE001 — a dead phone must never break the broadcast for everyone
            self.sockets.get(code, {}).pop(ws, None)

    def broadcast_threadsafe(self, code: str, message: dict) -> None:
        """Called from sync request handlers (thread pool): send on each socket's own loop."""
        for ws, (_, _, owner) in list(self.sockets.get(code, {}).items()):
            if owner.is_running():
                asyncio.run_coroutine_threadsafe(ws.send_json(message), owner)
