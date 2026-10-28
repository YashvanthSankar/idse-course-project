"""Careers live in the same database as telemetry (Postgres in production, SQLite locally),
one row per career code. A small in-memory cache keeps reads instant."""

import secrets
import time
from threading import Lock

from sqlalchemy import Column, Float, MetaData, String, Table, Text, create_engine, insert, select
from sqlalchemy import update as sql_update

from auditor.career.rules import Career
from auditor.telemetry import default_target, normalise_url

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I/L to misread

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
    return f"{raw[:3]}-{raw[3:]}" if len(raw) == 6 else code.upper()


class CareerStore:
    def __init__(self, path: str | None = None):
        url = normalise_url(path or default_target())
        sqlite = url.startswith("sqlite")
        self._engine = create_engine(
            url, connect_args={"check_same_thread": False} if sqlite else {},
            pool_pre_ping=not sqlite)
        _meta.create_all(self._engine)
        self._cache: dict[str, Career] = {}
        self._locks: dict[str, Lock] = {}
        self._guard = Lock()

    def lock(self, code: str) -> Lock:
        """One writer per career at a time."""
        with self._guard:
            return self._locks.setdefault(code, Lock())

    def get(self, code: str) -> Career:
        """KeyError when there's no such career."""
        if code in self._cache:
            return self._cache[code]
        with self._engine.connect() as conn:
            row = conn.execute(select(careers.c.state).where(careers.c.code == code)).first()
        if row is None:
            raise KeyError(code)
        career = Career.model_validate_json(row.state)
        self._cache[code] = career
        return career

    def save(self, career: Career) -> None:
        state = career.model_dump_json()
        with self._engine.begin() as conn:
            done = conn.execute(sql_update(careers).where(careers.c.code == career.code)
                                .values(state=state, updated=time.time())).rowcount
            if not done:
                conn.execute(insert(careers).values(code=career.code, state=state,
                                                    updated=time.time()))
        self._cache[career.code] = career

    def unused_code(self) -> str:
        while True:
            code = new_code()
            try:
                self.get(code)
            except KeyError:
                return code
