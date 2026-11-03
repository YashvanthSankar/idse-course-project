"""In-memory case sessions (single uvicorn worker by design)."""

import os
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


def _solved(session: CaseSession) -> bool:
    return session.verdict is not None or session.career_verdict is not None


def _rows(session: CaseSession) -> int:
    return len(session.bundle.df)


# About 0.8 KB of memory per ledger row once a few tools have run (measured): 400k rows is
# ~350 MB, what the 1 GB server can spare. Set AUDITOR_MAX_ROWS to change it.
MAX_ROWS = int(os.getenv("AUDITOR_MAX_ROWS", "400000"))


class SessionStore:
    """LRU of live cases, bounded by count and by the ledger rows they hold. Idle cases expire
    (solved ones sooner: only the verdict screen and the report still read them). When full,
    solved cases go first, then the least recently used; cases of a running class never go."""

    def __init__(self, max_size: int = 2000, ttl_seconds: float = 6 * 3600,
                 clock: Callable[[], float] = time.monotonic,
                 solved_ttl_seconds: float = 30 * 60, max_rows: int = MAX_ROWS):
        self.max_size, self.ttl, self.clock = max_size, ttl_seconds, clock
        self.solved_ttl = min(solved_ttl_seconds, ttl_seconds)
        self.max_rows = max_rows
        self.protect: Callable[[CaseSession], bool] = lambda _session: False
        self._sessions: OrderedDict[str, CaseSession] = OrderedDict()
        self._last_seen: dict[str, float] = {}
        self._rows = 0
        self._lock = Lock()

    @staticmethod
    def new_id() -> str:
        return uuid4().hex[:12]

    @property
    def rows(self) -> int:
        return self._rows

    def _drop(self, case_id: str) -> None:
        session = self._sessions.pop(case_id, None)
        self._last_seen.pop(case_id, None)
        if session is not None:
            self._rows -= _rows(session)

    def _full(self) -> bool:
        return len(self._sessions) > self.max_size or self._rows > self.max_rows

    def create(self, session: CaseSession) -> str:
        with self._lock:
            now = self.clock()
            for case_id, seen in list(self._last_seen.items()):
                old = self._sessions[case_id]
                if now - seen > (self.solved_ttl if _solved(old) else self.ttl) and \
                        not self.protect(old):
                    self._drop(case_id)
            self._drop(session.case_id)  # a rebuilt case replaces its old self
            self._sessions[session.case_id] = session
            self._last_seen[session.case_id] = now
            self._rows += _rows(session)
            # Over capacity: solved cases first, then the least recently used
            for solved_only in (True, False):
                for case_id in list(self._sessions):
                    if not self._full():
                        return session.case_id
                    old = self._sessions[case_id]
                    if case_id != session.case_id and not self.protect(old) and (
                            _solved(old) or not solved_only):
                        self._drop(case_id)
        return session.case_id

    def get(self, case_id: str) -> CaseSession:
        with self._lock:
            session = self._sessions[case_id]  # KeyError -> 404
            self._sessions.move_to_end(case_id)
            self._last_seen[case_id] = self.clock()
            return session
