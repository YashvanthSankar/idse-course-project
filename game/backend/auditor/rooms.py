"""Class Mode: a whole classroom plays the same case live, on their phones."""

import asyncio
import secrets
import threading
import time
from collections import deque
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
GRACE_SECONDS = 15  # accusations sent just as the clock hits zero still count
ROOM_TTL_SECONDS = 12 * 3600
TICKER_LINES = 6  # what a projector that reconnects gets back


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
    seconds: int = 0  # the round's length, so a screen that reconnects can draw the clock
    started_at: float = 0.0  # monotonic clock, shared start line for every timer
    players: dict[str, PlayerState] = field(default_factory=dict)
    bundle: CaseBundle | None = None
    round: int = 0
    host_token: str = field(default_factory=lambda: secrets.token_urlsafe(24))
    created_at: float = 0.0  # epoch seconds
    ticker: deque[str] = field(default_factory=lambda: deque(maxlen=TICKER_LINES))


class RoomManager:
    def __init__(self, store: SessionStore, telemetry: Telemetry, clock: Callable[[], float],
                 wall: Callable[[], float] = time.time):
        self.store, self.telemetry, self.clock, self.wall = store, telemetry, clock, wall
        self.rooms: dict[str, Room] = {}
        # socket -> (role, player_id, the event loop that owns the socket)
        self.sockets: dict[str, dict[WebSocket, tuple[str, str | None,
                                                      asyncio.AbstractEventLoop]]] = {}
        self._lock = threading.RLock()  # START and late joins must not interleave

    # ---- state ------------------------------------------------------------

    def create(self) -> str:
        now = self.wall()
        for old in [c for c, r in self.rooms.items() if now - r.created_at > ROOM_TTL_SECONDS]:
            del self.rooms[old]
            self.sockets.pop(old, None)
        for _ in range(1000):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
            if code not in self.rooms:
                self.rooms[code] = Room(code=code, created_at=now)
                self.sockets[code] = {}
                return code
        raise RuntimeError("No free room codes")

    def is_live(self, code: str | None) -> bool:
        room = self.rooms.get(code or "")
        return room is not None and room.status == "running"

    def host_ok(self, code: str, token: str | None) -> bool:
        return secrets.compare_digest(token or "", self.rooms[code].host_token)

    def join(self, code: str, player_id: str, name: str) -> PlayerState:
        room = self.rooms[code]
        player = room.players.get(player_id)
        if player is None:
            clean = (name or "Detective").strip()[:MAX_NAME] or "Detective"
            player = room.players[player_id] = PlayerState(player_id=player_id, name=clean)
        player.connected = True
        return player

    def start(self, code: str, level: int, seconds: int) -> dict[str, str]:
        seed = secrets.randbelow(2**31)
        bundle = build_case(level, seed)  # outside the lock: the slow part
        with self._lock:
            room = self.rooms[code]
            room.level, room.seed, room.bundle = level, seed, bundle
            room.round += 1
            room.status, room.started_at = "running", self.clock()
            room.ends_at, room.seconds = self.wall() + seconds, seconds
            room.ticker.clear()
            for player in list(room.players.values()):
                player.case_id, player.score, player.solved, player.correct = None, 0, False, False
                player.solved_at = None
            return {pid: self.ensure_case(code, pid) for pid in list(room.players)}

    def ensure_case(self, code: str, player_id: str) -> str | None:
        """Give the player their copy of the round's case (late joiners included)."""
        with self._lock:
            return self._ensure_case(code, player_id)

    def _ensure_case(self, code: str, player_id: str) -> str | None:
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

    async def end_after(self, code: str, round_no: int, delay: float) -> None:
        """Server-side clock: end the round even if the projector tab is asleep."""
        await asyncio.sleep(delay)
        room = self.rooms.get(code)
        if room is None or room.round != round_no or room.status != "running":
            return
        self.end(code)
        await self.broadcast(code, {"type": "round_end"})
        await self.to_hosts(code, self.leaderboard(code))

    def record_verdict(self, session: CaseSession, verdict: Verdict) -> bool:
        room = self.rooms.get(session.room_code or "")
        player = room.players.get(session.player_id or "") if room else None
        if player is None or player.solved or room.status != "running":
            return False  # late accusations still get a verdict, just not a podium place
        if room.ends_at is not None and self.wall() > room.ends_at + GRACE_SECONDS:
            self.end(room.code)
            return False
        player.solved, player.correct, player.score = True, verdict.correct, verdict.score
        player.solved_at = self.clock()
        self.broadcast_threadsafe(room.code, self.leaderboard(room.code))
        self._tick(room, f"{player.name} made an accusation")
        return True

    def tool_ran(self, session: CaseSession, tool_name: str) -> None:
        room = self.rooms.get(session.room_code or "")
        player = room.players.get(session.player_id or "") if room else None
        if player is not None:
            self._tick(room, f"{player.name} ran {tool_name}")

    def _tick(self, room: Room, text: str) -> None:
        room.ticker.append(text)
        self.broadcast_threadsafe(room.code, {"type": "ticker", "text": text})

    # ---- messages ---------------------------------------------------------

    def lobby(self, code: str) -> dict:
        room = self.rooms[code]
        return {"type": "lobby", "status": room.status,
                "level": room.level if room.round else None, "seconds": room.seconds or None,
                "players": [
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
                "ends_at": int((room.ends_at or 0) * 1000), "seconds": room.seconds,
                "grace": GRACE_SECONDS}

    def host_catch_up(self, code: str) -> list[dict]:
        """Everything a projector that (re)connects needs to redraw the room as it is."""
        room = self.rooms[code]
        messages = [self.lobby(code)]
        if room.status == "running":
            messages.append(self.round_start(code))
        if room.round:
            messages.append(self.leaderboard(code))
            messages += [{"type": "ticker", "text": t} for t in room.ticker]
        return messages

    # ---- sockets ----------------------------------------------------------

    def add_socket(self, code: str, ws: WebSocket, role: str, player_id: str | None) -> None:
        self.sockets[code][ws] = (role, player_id, asyncio.get_running_loop())

    def remove_socket(self, code: str, ws: WebSocket) -> None:
        role, player_id, _ = self.sockets[code].pop(ws, ("host", None, None))
        if role == "player" and player_id:
            still_here = any(pid == player_id for _, pid, _ in self.sockets[code].values())
            self.rooms[code].players[player_id].connected = still_here

    async def broadcast(self, code: str, message: dict, hosts_only: bool = False) -> None:
        for ws, (role, _, _) in list(self.sockets.get(code, {}).items()):
            if not hosts_only or role == "host":
                await self._send(code, ws, message)

    async def to_hosts(self, code: str, message: dict) -> None:
        """Lobby, leaderboard and ticker are for the projector only: phones don't need the
        roster, and sending it to every phone on every join would be O(players^2)."""
        await self.broadcast(code, message, hosts_only=True)

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
        """Called from sync request handlers (thread pool): reach each host on its own loop."""
        for ws, (role, _, owner) in list(self.sockets.get(code, {}).items()):
            if role == "host" and owner.is_running():
                asyncio.run_coroutine_threadsafe(ws.send_json(message), owner)
