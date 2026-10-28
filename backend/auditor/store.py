"""In-memory case sessions (single uvicorn worker by design)."""

import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Lock
from typing import Any
from uuid import uuid4

from auditor.generator.cases import CaseBundle
from auditor.models import ToolResult, Verdict


@dataclass
class CaseSession:
    bundle: CaseBundle
    budget_left: int
    started_at: float
    player_id: str | None = None
    room_code: str | None = None
    results: dict[str, ToolResult] = field(default_factory=dict)
    cache: dict[tuple, str] = field(default_factory=dict)
    verdict: Verdict | None = None
    lock: Lock = field(default_factory=Lock)
    # Career Mode: which career and contract case this is, and who in the lineup is an old
    # colleague (suspect id -> cameo id)
    career_code: str | None = None
    career_index: int | None = None
    lineup_cameos: dict[str, str] = field(default_factory=dict)
    career_verdict: Any = None

    @property
    def case_id(self) -> str:
        return self.bundle.meta.case_id


class SessionStore:
    """LRU of live cases. Idle cases expire; cases of a running class are never evicted."""

    def __init__(self, max_size: int = 2000, ttl_seconds: float = 6 * 3600,
                 clock: Callable[[], float] = time.monotonic):
        self.max_size, self.ttl, self.clock = max_size, ttl_seconds, clock
        self.protect: Callable[[CaseSession], bool] = lambda _session: False
        self._sessions: OrderedDict[str, CaseSession] = OrderedDict()
        self._last_seen: dict[str, float] = {}
        self._lock = Lock()

    @staticmethod
    def new_id() -> str:
        return uuid4().hex[:12]

    def _drop(self, case_id: str) -> None:
        self._sessions.pop(case_id, None)
        self._last_seen.pop(case_id, None)

    def create(self, session: CaseSession) -> str:
        with self._lock:
            now = self.clock()
            for case_id in [c for c, seen in self._last_seen.items() if now - seen > self.ttl]:
                if not self.protect(self._sessions[case_id]):
                    self._drop(case_id)
            self._sessions[session.case_id] = session
            self._last_seen[session.case_id] = now
            # Over capacity: evict the least recently used case that isn't in a live class
            for case_id in list(self._sessions):
                if len(self._sessions) <= self.max_size:
                    break
                if case_id != session.case_id and not self.protect(self._sessions[case_id]):
                    self._drop(case_id)
        return session.case_id

    def get(self, case_id: str) -> CaseSession:
        with self._lock:
            session = self._sessions[case_id]  # KeyError -> 404
            self._sessions.move_to_end(case_id)
            self._last_seen[case_id] = self.clock()
            return session
