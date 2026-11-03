"""Careers live in the same database as telemetry (Postgres in production, SQLite locally),
one row per career code.

The in-memory cache is the source of truth while the server runs: a save swaps the new state
into the cache at once and a background thread writes it to the database, so no request ever
waits on a slow database. Several saves of one career in a row collapse into one write, and a
failed write is retried until it lands."""

import logging
import secrets
import threading
import time
import zlib
from collections import OrderedDict

from sqlalchemy import Column, Float, MetaData, String, Table, Text, create_engine, insert, select
from sqlalchemy import update as sql_update

from auditor.career.rules import Career
from auditor.telemetry import default_target, normalise_url

log = logging.getLogger(__name__)

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I/L to misread
CACHE_SIZE = 1000  # careers kept in memory; the rest reload from the database
LOCK_STRIPES = 64
RETRY_SECONDS = (0.5, 1, 2, 5, 10, 30)

_meta = MetaData()
careers = Table(
    "careers", _meta,
    Column("code", String(16), primary_key=True),
    Column("state", Text),
    Column("updated", Float),
)


def new_code() -> str:
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
    return f"{raw[:3]}-{raw[3:]}"


def normalise_code(code: str) -> str:
    raw = "".join(ch for ch in code.upper() if ch in CODE_ALPHABET)
    return f"{raw[:3]}-{raw[3:]}" if len(raw) == 6 else code.upper()[:16]


class CareerStore:
    def __init__(self, path: str | None = None, cache_size: int = CACHE_SIZE):
        url = normalise_url(path or default_target())
        sqlite = url.startswith("sqlite")
        self._engine = create_engine(
            url, connect_args={"check_same_thread": False} if sqlite else {},
            pool_pre_ping=not sqlite)
        _meta.create_all(self._engine)
        self._cache_size = cache_size
        self._cache: OrderedDict[str, Career] = OrderedDict()
        self._pending: dict[str, str] = {}  # code -> state not yet in the database
        self._writing: set[str] = set()
        self._stripes = [threading.Lock() for _ in range(LOCK_STRIPES)]
        self._guard = threading.Lock()
        self._changed = threading.Condition(self._guard)
        threading.Thread(target=self._drain, daemon=True, name="career-writer").start()

    def lock(self, code: str) -> threading.Lock:
        """One writer per career at a time (careers share a fixed set of locks)."""
        return self._stripes[zlib.crc32(code.encode()) % LOCK_STRIPES]

    def get(self, code: str) -> Career:
        """The live career, read-only: copy it before changing it, then `save` the copy.
        KeyError when there's no such career."""
        with self._guard:
            if code in self._cache:
                self._cache.move_to_end(code)
                return self._cache[code]
        with self._engine.connect() as conn:
            row = conn.execute(select(careers.c.state).where(careers.c.code == code)).first()
        if row is None:
            raise KeyError(code)
        career = Career.model_validate_json(row.state)
        with self._guard:
            if code in self._cache:  # someone saved it while we were reading
                return self._cache[code]
            self._remember(code, career)
        return career

    def save(self, career: Career) -> None:
        """Swap the new state in now; the database catches up in the background."""
        state = career.model_dump_json()
        with self._guard:
            self._remember(career.code, career)
            self._pending[career.code] = state
            self._changed.notify_all()

    def flush(self, timeout: float = 30.0) -> bool:
        """Wait until every save is in the database (tests and shutdown)."""
        deadline = time.monotonic() + timeout
        with self._guard:
            while self._pending or self._writing:
                left = deadline - time.monotonic()
                if left <= 0:
                    return False
                self._changed.wait(left)
        return True

    def unused_code(self) -> str:
        while True:
            code = new_code()
            try:
                self.get(code)
            except KeyError:
                return code

    def _remember(self, code: str, career: Career) -> None:
        """Caller holds the guard. Unwritten careers are never evicted."""
        self._cache[code] = career
        self._cache.move_to_end(code)
        for old in list(self._cache):
            if len(self._cache) <= self._cache_size:
                break
            if old != code and old not in self._pending and old not in self._writing:
                del self._cache[old]

    def _drain(self) -> None:
        failures = 0
        while True:
            with self._guard:
                while not self._pending:
                    self._changed.wait()
                batch, self._pending = self._pending, {}
                self._writing = set(batch)
            try:
                self._write(batch)
                failures = 0
            except Exception:
                log.exception("Saving %d careers failed; retrying", len(batch))
                with self._guard:  # a newer save of the same career wins
                    self._pending = {**batch, **self._pending}
                time.sleep(RETRY_SECONDS[min(failures, len(RETRY_SECONDS) - 1)])
                failures += 1
            finally:
                with self._guard:
                    self._writing = set()
                    self._changed.notify_all()

    def _write(self, batch: dict[str, str]) -> None:
        now = time.time()
        with self._engine.begin() as conn:
            for code, state in batch.items():
                done = conn.execute(sql_update(careers).where(careers.c.code == code)
                                    .values(state=state, updated=now)).rowcount
                if not done:
                    conn.execute(insert(careers).values(code=code, state=state, updated=now))
