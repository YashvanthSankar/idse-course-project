"""FastAPI app: the game's HTTP interface to the Python brain."""

import asyncio
import io
import json
import math
import os
import secrets
import time
from collections import Counter, deque
from collections.abc import Callable
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from auditor.adapt import pick_scheme
from auditor.autopsy import build_autopsy
from auditor.charts import reveal_figure
from auditor.generator.cases import build_case, level_infos
from auditor.models import (
    Accusation,
    CaseMeta,
    CaseTruth,
    LevelInfo,
    Profile,
    ToolId,
    ToolResult,
    ToolSpec,
    Verdict,
)
from auditor.profiles import profile_for
from auditor.report import render_report
from auditor.rooms import GRACE_SECONDS, RoomManager
from auditor.scoring import score_accusation
from auditor.store import CaseSession, SessionStore
from auditor.telemetry import Telemetry
from auditor.tools.registry import TOOLS, resolve_params, run_tool, tool_specs

MAX_TABLE_ROWS = 200


class CaseCreate(BaseModel):
    level: int = Field(ge=1, le=7)
    seed: int | None = None
    player_id: str | None = None


class ToolRun(BaseModel):
    params: dict = Field(default_factory=dict)


class Rows(BaseModel):
    rows: list[dict]
    total: int


class Budget(BaseModel):
    budget_left: int


class CaseState(BaseModel):
    """Everything needed to restore a case after a reload or a locked phone."""

    meta: CaseMeta
    results: list[ToolResult]
    verdict: Verdict | None


class RoomCreated(BaseModel):
    code: str
    host_token: str  # only the session that created the room may drive the projector


class AutopsySlide(BaseModel):
    title: str
    figure: dict
    code: str
    stats: dict


class Autopsy(BaseModel):
    slides: list[AutopsySlide]


def _records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> JSON-safe records (dates as ISO strings, NaN as null)."""
    return json.loads(df.to_json(orient="records", date_format="iso", date_unit="s"))


def _clean_stats(stats: dict) -> dict[str, float | str]:
    out: dict[str, float | str] = {}
    for key, value in stats.items():
        if isinstance(value, str):
            out[key] = value
        else:
            number = float(value)
            out[key] = number if math.isfinite(number) else str(number)
    return out


def _meta(session: CaseSession) -> CaseMeta:
    return session.bundle.meta.model_copy(update={"budget_left": session.budget_left})


def create_app(store: SessionStore | None = None, telemetry: Telemetry | None = None,
               clock: Callable[[], float] = time.monotonic, rate_limit: int = 240) -> FastAPI:
    app = FastAPI(title="The Auditor — Python brain", version="1.0.0")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                       allow_headers=["*"])
    app.state.store = store or SessionStore()
    app.state.clock = clock
    app.state.telemetry = telemetry or Telemetry()
    app.state.rooms = RoomManager(app.state.store, app.state.telemetry, clock)
    app.state.on_verdict = [app.state.rooms.record_verdict]  # hooks: Class Mode listens here
    app.state.on_tool_run = [app.state.rooms.tool_ran]
    app.state.store.protect = lambda s: app.state.rooms.is_live(s.room_code)
    timers: set[asyncio.Task] = set()  # keep round timers alive until they fire
    hits: dict[tuple[str, str], deque[float]] = {}

    def limit(request: Request, bucket: str) -> None:
        """At most `rate_limit` creations per minute per client address and bucket."""
        key = (bucket, request.client.host if request.client else "?")
        window = hits.setdefault(key, deque())
        now = time.monotonic()
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= rate_limit:
            raise HTTPException(429, "Slow down, detective")
        window.append(now)

    def log(event, session: CaseSession, **kw):
        app.state.telemetry.log(event, player_id=session.player_id, case_id=session.case_id,
                                room_code=session.room_code, **kw)

    @app.exception_handler(KeyError)
    async def missing(_: Request, exc: KeyError):
        return JSONResponse(status_code=404, content={"detail": "Case not found"})

    def session_for(case_id: str) -> CaseSession:
        return app.state.store.get(case_id)

    @app.get("/api/levels", response_model=list[LevelInfo])
    def levels():
        return level_infos()

    @app.post("/api/cases", response_model=CaseMeta)
    def create_case(body: CaseCreate, request: Request):
        limit(request, "cases")
        seed = body.seed if body.seed is not None else secrets.randbelow(2**31)
        scheme = None
        if body.level == 7 and body.player_id:  # endless mode: the fraudster studies you
            events = app.state.telemetry.events_df()
            used = events[(events["player_id"] == body.player_id)
                          & (events["type"] == "tool_run")]["tool_id"]
            scheme = pick_scheme(Counter(used), np.random.default_rng(seed))
        bundle = build_case(body.level, seed, scheme_override=scheme,
                            case_id=SessionStore.new_id())
        session = CaseSession(bundle=bundle, budget_left=bundle.meta.budget,
                              started_at=app.state.clock(), player_id=body.player_id)
        app.state.store.create(session)
        log("case_started", session, payload={"level": body.level, "seed": seed})
        return _meta(session)

    @app.get("/api/cases/{case_id}", response_model=CaseMeta)
    def get_case(case_id: str):
        return _meta(session_for(case_id))

    @app.get("/api/cases/{case_id}/state", response_model=CaseState)
    def case_state(case_id: str):
        session = session_for(case_id)
        return CaseState(meta=_meta(session), results=list(session.results.values()),
                         verdict=session.verdict)

    @app.get("/api/cases/{case_id}/rows", response_model=Rows)
    def rows(case_id: str, offset: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=2000)):
        df = session_for(case_id).bundle.df
        return Rows(rows=_records(df.iloc[offset:offset + limit]), total=len(df))

    @app.get("/api/cases/{case_id}/data.csv")
    def data_csv(case_id: str):
        buffer = io.StringIO()
        session_for(case_id).bundle.df.to_csv(buffer, index=False)
        return Response(buffer.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="{case_id}.csv"'})

    @app.get("/api/tools", response_model=list[ToolSpec])
    def tools(level: int = Query(1, ge=1, le=7)):
        return tool_specs(level)

    @app.post("/api/cases/{case_id}/tools/{tool_id}", response_model=ToolResult)
    def use_tool(case_id: str, tool_id: ToolId, body: ToolRun | None = None):
        session = session_for(case_id)
        meta = session.bundle.meta
        if tool_id not in meta.unlocked_tools:
            raise HTTPException(403, f"{TOOLS[tool_id].name} unlocks at case "
                                     f"{TOOLS[tool_id].unlock_level}")
        try:
            params = resolve_params(tool_id, (body or ToolRun()).params)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None

        key = (tool_id, tuple(sorted(params.items())))
        with session.lock:
            if key in session.cache:
                cached = session.results[session.cache[key]]
                return cached.model_copy(update={"cost_charged": 0,
                                                 "budget_left": session.budget_left})
            cost = TOOLS[tool_id].cost
            if cost > session.budget_left:
                raise HTTPException(409, "Out of budget")

            names = {s.id: s.name for s in meta.suspects}
            analysis, figure, code = run_tool(tool_id, session.bundle.df, params, names)
            session.budget_left -= cost
            result = ToolResult(
                result_id=uuid4().hex[:10], tool_id=tool_id, params=params,
                title=analysis.title, summary=analysis.summary, figure=figure,
                table=None if analysis.table is None else _records(
                    analysis.table.head(MAX_TABLE_ROWS)),
                code=code, stats=_clean_stats(analysis.stats), implicates=analysis.implicates,
                cost_charged=cost, budget_left=session.budget_left,
            )
            session.results[result.result_id] = result
            session.cache[key] = result.result_id
        log("tool_run", session, tool_id=tool_id,
            payload={"cost": cost, "params": params, "implicates": result.implicates,
                     "visual": TOOLS[tool_id].visual})
        for hook in app.state.on_tool_run:
            hook(session, TOOLS[tool_id].name)
        return result

    @app.post("/api/cases/{case_id}/hacker-charge", response_model=Budget)
    def hacker_charge(case_id: str):
        session = session_for(case_id)
        with session.lock:
            if session.budget_left < 1:
                raise HTTPException(409, "Out of budget")
            session.budget_left -= 1
        log("hacker_query", session, payload={"budget_left": session.budget_left})
        return Budget(budget_left=session.budget_left)

    @app.post("/api/cases/{case_id}/accuse", response_model=Verdict)
    def accuse(case_id: str, body: Accusation):
        session = session_for(case_id)
        meta = session.bundle.meta
        with session.lock:
            if session.verdict is not None:
                return session.verdict  # one shot, no take-backs
            # Two different clues — unless the budget is spent, then every clue you have
            needed = 2 if session.budget_left > 0 else min(2, len(session.results))
            ids = body.evidence_ids
            if len(set(ids)) != len(ids) or any(e not in session.results for e in ids):
                raise HTTPException(422, "Attach different pieces of evidence from this case")
            if len(ids) != needed:
                raise HTTPException(422, "Attach two different pieces of pinned evidence"
                                    if needed == 2 else f"Attach all {needed} clue(s) you have")
            if body.suspect_id not in {s.id for s in meta.suspects}:
                raise HTTPException(422, "Unknown suspect")
            truth = session.bundle.truth
            elapsed = int(app.state.clock() - session.started_at)
            verdict = score_accusation(truth, meta.suspects, body.suspect_id,
                                       [session.results[e] for e in body.evidence_ids],
                                       session.budget_left, elapsed)
            names = {s.id: s.name for s in meta.suspects}
            verdict.reveal_figure = reveal_figure(session.bundle.df, truth.fraudster_id,
                                                  truth.fraud_txn_ids, names)
            session.verdict = verdict
        log("accused", session, payload={
            "level": meta.level, "accused": body.suspect_id, "correct": verdict.correct,
            "score": verdict.score, "budget_left": session.budget_left, "elapsed_s": elapsed,
            "n_tools": len(session.results), "evidence": [g.grade for g in verdict.evidence]})
        for hook in app.state.on_verdict:
            hook(session, verdict)
        return verdict

    @app.get("/api/cases/{case_id}/report.pdf")
    def report(case_id: str):
        session = session_for(case_id)
        if session.verdict is None:
            raise HTTPException(409, "Close the case first")
        return Response(render_report(session), media_type="application/pdf",
                        headers={"Content-Disposition":
                                 f'attachment; filename="case-{case_id}.pdf"'})

    @app.post("/api/rooms", response_model=RoomCreated)
    def create_room(request: Request):
        limit(request, "rooms")
        code = app.state.rooms.create()
        return RoomCreated(code=code, host_token=app.state.rooms.rooms[code].host_token)

    @app.websocket("/ws/rooms/{code}")
    async def room_socket(ws: WebSocket, code: str, role: str = "player",
                          player_id: str | None = None, name: str = "Detective",
                          token: str | None = None):
        rooms: RoomManager = app.state.rooms
        await ws.accept()
        if code not in rooms.rooms:
            await ws.close(code=4404)  # browsers only see close codes after an accept
            return
        if role == "host" and not rooms.host_ok(code, token):
            await ws.close(code=4403)
            return
        room = rooms.rooms[code]
        pid = player_id or uuid4().hex[:10] if role == "player" else None
        rooms.add_socket(code, ws, role, pid)
        try:
            if role == "host":
                await ws.send_json(rooms.lobby(code))
                if room.status == "running":
                    await ws.send_json(rooms.round_start(code))
                    await ws.send_json(rooms.leaderboard(code))
            else:
                rooms.join(code, pid, name)
                case_id = await run_in_threadpool(rooms.ensure_case, code, pid)
                await ws.send_json({"type": "welcome", "player_id": pid,
                                    "status": room.status})
                if case_id:
                    await ws.send_json(rooms.round_start(code))
                    await ws.send_json({"type": "your_case", "case_id": case_id})
                await rooms.to_hosts(code, rooms.lobby(code))
            while True:
                message = await ws.receive_json()
                if role != "host":
                    continue
                if message.get("type") == "start":
                    level = min(7, max(1, int(message.get("level", 1))))
                    seconds = min(1800, max(30, int(message.get("seconds", 360))))
                    assignments = await run_in_threadpool(rooms.start, code, level, seconds)
                    timer = asyncio.create_task(
                        rooms.end_after(code, room.round, seconds + GRACE_SECONDS))
                    timers.add(timer)
                    timer.add_done_callback(timers.discard)
                    await rooms.broadcast(code, rooms.round_start(code))
                    for player, case_id in assignments.items():
                        await rooms.send_to_player(code, player,
                                                   {"type": "your_case", "case_id": case_id})
                    await rooms.to_hosts(code, rooms.leaderboard(code))
                elif message.get("type") == "end":
                    rooms.end(code)
                    await rooms.broadcast(code, {"type": "round_end"})
                    await rooms.to_hosts(code, rooms.leaderboard(code))
        except WebSocketDisconnect:
            pass
        finally:
            rooms.remove_socket(code, ws)
            if role == "player":
                await rooms.to_hosts(code, rooms.lobby(code))

    @app.get("/api/rooms/{code}/autopsy", response_model=Autopsy)
    def autopsy(code: str):
        if code not in app.state.rooms.rooms:
            raise HTTPException(404, "Room not found")
        events = app.state.telemetry.events_df(room_code=code)
        return Autopsy(slides=[AutopsySlide(**vars(s)) for s in build_autopsy(events)])

    @app.get("/api/players/{player_id}/profile", response_model=Profile)
    def profile(player_id: str):
        events = app.state.telemetry.events_df()
        mine = events[events["player_id"] == player_id]
        if mine.empty:
            raise HTTPException(404, "No such detective")
        room = mine["room_code"].dropna()
        if not room.empty:  # compare against your own classroom
            events = app.state.telemetry.events_df(room_code=room.iloc[-1])
        name = next((r.players[player_id].name for r in app.state.rooms.rooms.values()
                     if player_id in r.players), "Detective")
        return profile_for(player_id, events, name=name)

    @app.get("/api/debug/cases/{case_id}/truth", response_model=CaseTruth)
    def debug_truth(case_id: str):
        if os.getenv("AUDITOR_DEBUG") != "1":
            raise HTTPException(404, "Not Found")
        return session_for(case_id).bundle.truth

    return app


app = create_app()
