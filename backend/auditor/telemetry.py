"""Every click is data: a tiny SQLite event log that pandas reads back for the Class Autopsy."""

import json
import os
import sqlite3
import time
from threading import Lock
from typing import Literal

import pandas as pd

EventType = Literal["case_started", "tool_run", "hacker_query", "accused"]
COLUMNS = ["ts", "type", "player_id", "case_id", "room_code", "tool_id", "payload"]


class Telemetry:
    def __init__(self, path: str | None = None):
        self.path = path or os.getenv("AUDITOR_DB", "auditor.db")
        self._lock = Lock()
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, "
            "type TEXT, player_id TEXT, case_id TEXT, room_code TEXT, tool_id TEXT, payload TEXT)"
        )
        self._db.commit()

    def log(self, event_type: EventType, *, player_id: str | None, case_id: str,
            room_code: str | None = None, tool_id: str | None = None,
            payload: dict | None = None) -> None:
        with self._lock:
            self._db.execute(
                "INSERT INTO events (ts, type, player_id, case_id, room_code, tool_id, payload) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (time.time(), event_type, player_id, case_id, room_code, tool_id,
                 json.dumps(payload or {})),
            )
            self._db.commit()

    def events_df(self, room_code: str | None = None) -> pd.DataFrame:
        query = "SELECT ts, type, player_id, case_id, room_code, tool_id, payload FROM events"
        params: tuple = ()
        if room_code is not None:
            query += " WHERE room_code = ?"
            params = (room_code,)
        with self._lock:
            df = pd.read_sql(query + " ORDER BY id", self._db, params=params)
        df["payload"] = df["payload"].map(json.loads)
        return df[COLUMNS]
