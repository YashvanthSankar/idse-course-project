"""Shared vocabulary of the game: every id and schema the API speaks."""

from typing import Literal

from pydantic import BaseModel, Field

SchemeId = Literal[
    "big_invoice", "duplicates", "fabricated", "weekend", "inflated_ratio", "under_limit"
]
ToolId = Literal[
    "summary", "groupby", "zscore", "iqr_box", "duplicates",
    "benford", "timeseries", "regression", "isoforest",
]
HerringId = Literal["ceo", "diwali"]
Grade = Literal["strong", "supportive", "weak", "irrelevant"]


class Suspect(BaseModel):
    id: str
    name: str
    role: str
    department: str
    bio: str
    portrait: str


class CaseMeta(BaseModel):
    """Everything the player may see about a case. Never carries the truth."""

    case_id: str
    level: int
    title: str
    briefing: str
    budget: int
    budget_left: int
    suspects: list[Suspect]
    columns: list[str]
    n_rows: int
    unlocked_tools: list[ToolId]


class CaseTruth(BaseModel):
    """Server-side only until the verdict."""

    fraudster_id: str | None
    scheme: SchemeId | None
    fraud_txn_ids: list[str]
    catching_tools: list[ToolId]
    herrings: list[HerringId]
    explanation: str


class LevelInfo(BaseModel):
    level: int
    title: str
    teaser: str
    budget: int
    difficulty: int


class ToolSpec(BaseModel):
    id: ToolId
    name: str
    cost: int
    unlock_level: int
    params: dict[str, list[str] | float]
    visual: bool
    unlocked: bool = True


class ToolResult(BaseModel):
    result_id: str
    tool_id: ToolId
    params: dict
    title: str
    summary: str
    figure: dict
    table: list[dict] | None
    code: str
    stats: dict[str, float | str]
    implicates: list[str]
    cost_charged: int
    budget_left: int


class Accusation(BaseModel):
    suspect_id: str
    # Two clues normally; fewer only when the budget is gone (see the accuse route)
    evidence_ids: list[str] = Field(default_factory=list, max_length=2)


class EvidenceGrade(BaseModel):
    result_id: str
    tool_id: ToolId
    grade: Grade
    points: int


class Verdict(BaseModel):
    correct: bool
    score: int
    breakdown: dict[str, int]
    fraudster: Suspect
    scheme: SchemeId
    explanation: str
    fraud_txn_ids: list[str]
    catching_tools: list[ToolId]
    evidence: list[EvidenceGrade]
    reveal_figure: dict = Field(default_factory=dict)


class Profile(BaseModel):
    player_id: str
    name: str
    archetype: str
    tagline: str
    stats: dict[str, float]
    radar_figure: dict
