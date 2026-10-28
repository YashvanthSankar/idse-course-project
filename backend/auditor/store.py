"""In-memory case sessions (single uvicorn worker by design)."""

from collections import OrderedDict
from dataclasses import dataclass, field
from threading import Lock
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

    @property
    def case_id(self) -> str:
        return self.bundle.meta.case_id


class SessionStore:
    def __init__(self, max_size: int = 2000):
        self.max_size = max_size
        self._sessions: OrderedDict[str, CaseSession] = OrderedDict()
        self._lock = Lock()

    @staticmethod
    def new_id() -> str:
        return uuid4().hex[:12]

    def create(self, session: CaseSession) -> str:
        with self._lock:
            self._sessions[session.case_id] = session
            while len(self._sessions) > self.max_size:
                self._sessions.popitem(last=False)
        return session.case_id

    def get(self, case_id: str) -> CaseSession:
        with self._lock:
            session = self._sessions[case_id]  # KeyError -> 404
            self._sessions.move_to_end(case_id)
            return session
