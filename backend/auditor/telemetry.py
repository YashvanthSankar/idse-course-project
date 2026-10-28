"""Every click is data: an event log (SQLite locally, Postgres in production) that pandas
reads back for the Class Autopsy."""

import json
import os
import time
from threading import Lock
from typing import Literal

import pandas as pd
from sqlalchemy import (
    Column,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    insert,
    select,
)

EventType = Literal["case_started", "tool_run", "hacker_query", "accused"]
COLUMNS = ["ts", "type", "player_id", "case_id", "room_code", "tool_id", "payload"]

_meta = MetaData()
events = Table(
    "events", _meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("ts", Float), Column("type", String(32)), Column("player_id", String(64)),
    Column("case_id", String(64)), Column("room_code", String(16)), Column("tool_id", String(32)),
    Column("payload", Text),
)


def normalise_url(target: str) -> str:
    """A file path becomes SQLite; postgres:// URLs use the psycopg driver."""
    if "://" not in target:
        return f"sqlite:///{target}"
    for prefix in ("postgres://", "postgresql://"):
        if target.startswith(prefix):
            return "postgresql+psycopg://" + target[len(prefix):]
    return target


def default_target() -> str:
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    # Serverless hosts (Vercel) only allow writes under /tmp
    return os.getenv("AUDITOR_DB", "/tmp/auditor.db" if os.getenv("VERCEL") else "auditor.db")


class Telemetry:
    def __init__(self, path: str | None = None):
        self.url = normalise_url(path or default_target())
        sqlite = self.url.startswith("sqlite")
        self._engine = create_engine(
            self.url,
            connect_args={"check_same_thread": False} if sqlite else {},
            pool_pre_ping=not sqlite,
        )
        self._lock = Lock()
        _meta.create_all(self._engine)

    def log(self, event_type: EventType, *, player_id: str | None, case_id: str,
            room_code: str | None = None, tool_id: str | None = None,
            payload: dict | None = None) -> None:
        row = {"ts": time.time(), "type": event_type, "player_id": player_id, "case_id": case_id,
               "room_code": room_code, "tool_id": tool_id, "payload": json.dumps(payload or {})}
        with self._lock, self._engine.begin() as conn:
            conn.execute(insert(events), row)

    def events_df(self, room_code: str | None = None) -> pd.DataFrame:
        query = select(*(events.c[c] for c in COLUMNS)).order_by(events.c.id)
        if room_code is not None:
            query = query.where(events.c.room_code == room_code)
        with self._lock, self._engine.connect() as conn:
            df = pd.read_sql(query, conn)
        df["payload"] = df["payload"].map(json.loads)
        return df[COLUMNS]
