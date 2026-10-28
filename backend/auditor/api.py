"""FastAPI app: the game's HTTP interface to the Python brain."""

import io
import json
import math
import secrets
import time
from collections.abc import Callable
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from auditor.generator.cases import build_case, level_infos
from auditor.models import CaseMeta, LevelInfo, ToolId, ToolResult, ToolSpec
from auditor.store import CaseSession, SessionStore
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


def create_app(store: SessionStore | None = None,
               clock: Callable[[], float] = time.monotonic) -> FastAPI:
    app = FastAPI(title="The Auditor — Python brain", version="1.0.0")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                       allow_headers=["*"])
    app.state.store = store or SessionStore()
    app.state.clock = clock

    @app.exception_handler(KeyError)
    async def missing(_: Request, exc: KeyError):
        return JSONResponse(status_code=404, content={"detail": "Case not found"})

    def session_for(case_id: str) -> CaseSession:
        return app.state.store.get(case_id)

    @app.get("/api/levels", response_model=list[LevelInfo])
    def levels():
        return level_infos()

    @app.post("/api/cases", response_model=CaseMeta)
    def create_case(body: CaseCreate):
        seed = body.seed if body.seed is not None else secrets.randbelow(2**31)
        bundle = build_case(body.level, seed, case_id=SessionStore.new_id())
        session = CaseSession(bundle=bundle, budget_left=bundle.meta.budget,
                              started_at=app.state.clock(), player_id=body.player_id)
        app.state.store.create(session)
        return _meta(session)

    @app.get("/api/cases/{case_id}", response_model=CaseMeta)
    def get_case(case_id: str):
        return _meta(session_for(case_id))

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
            return result

    @app.post("/api/cases/{case_id}/hacker-charge", response_model=Budget)
    def hacker_charge(case_id: str):
        session = session_for(case_id)
        with session.lock:
            if session.budget_left < 1:
                raise HTTPException(409, "Out of budget")
            session.budget_left -= 1
            return Budget(budget_left=session.budget_left)

    return app


app = create_app()
