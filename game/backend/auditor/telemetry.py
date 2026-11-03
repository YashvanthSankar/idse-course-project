"""Every click is data: an event log (SQLite locally, Postgres in production) that pandas
reads back for the Class Autopsy."""

import json
import logging
import os
import queue
import threading
import time
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

log = logging.getLogger(__name__)

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
    """Players never wait on the database: events are queued and a background thread writes
    them in batches (a far-away Postgres can take ~1 s per round trip)."""

    def __init__(self, path: str | None = None):
        self.url = normalise_url(path or default_target())
        sqlite = self.url.startswith("sqlite")
        self._engine = create_engine(
            self.url,
            connect_args={"check_same_thread": False} if sqlite else {},
            pool_pre_ping=not sqlite,
        )
        _meta.create_all(self._engine)
        self._queue: queue.Queue[dict] = queue.Queue()
        threading.Thread(target=self._drain, name="telemetry-writer", daemon=True).start()

    def log(self, event_type: EventType, *, player_id: str | None, case_id: str,
            room_code: str | None = None, tool_id: str | None = None,
            payload: dict | None = None) -> None:
        self._queue.put({"ts": time.time(), "type": event_type, "player_id": player_id,
                         "case_id": case_id, "room_code": room_code, "tool_id": tool_id,
                         "payload": json.dumps(payload or {})})

    def flush(self) -> None:
        """Block until every queued event is in the database."""
        self._queue.join()

    def _drain(self) -> None:
        while True:
            rows = [self._queue.get()]
            while True:
                try:
                    rows.append(self._queue.get_nowait())
                except queue.Empty:
                    break
            try:
                self._write_batch(rows)
            except Exception:  # a database hiccup must never take the game down
                log.exception("telemetry: dropped %d event(s)", len(rows))
            finally:
                for _ in rows:
                    self._queue.task_done()

    def _write_batch(self, rows: list[dict]) -> None:
        with self._engine.begin() as conn:
            conn.execute(insert(events), rows)

    def events_df(self, room_code: str | None = None) -> pd.DataFrame:
        self.flush()
        query = select(*(events.c[c] for c in COLUMNS)).order_by(events.c.id)
        if room_code is not None:
            query = query.where(events.c.room_code == room_code)
        with self._engine.connect() as conn:
            df = pd.read_sql(query, conn)
        df["payload"] = df["payload"].map(json.loads)
        return df[COLUMNS]
