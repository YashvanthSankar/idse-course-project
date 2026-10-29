"""What proves a career case (CAREER.md §3.1): the theory you name, and the clues that back it.

A tool *fits* a theory when, in the calibration runs, it singled out the fraudster alone in at least
nine cases in ten and was right whenever it named one person. One fitting clue proves a case;
a clue that doesn't fit is only a lead, unless a second, different tool names the same person."""

from typing import Literal

from pydantic import BaseModel

from auditor.models import SchemeId, ToolId, ToolResult
from auditor.tools.registry import resolve_params

Proof = Literal["proven", "lead", "none"]


class ToolFit(BaseModel):
    tool: ToolId
    setting: str | None = None  # e.g. Pattern Matrix only fits when grouped by vendor


class Theory(BaseModel):
    id: SchemeId
    name: str
    fits: list[ToolFit]


THEORIES: list[Theory] = [
    Theory(id="big_invoice", name="One monster invoice",
           fits=[ToolFit(tool="iqr_box")]),  # Z-Score only says where to look (§3.1)
    Theory(id="duplicates", name="Billed twice",
           fits=[ToolFit(tool="duplicates")]),
    Theory(id="fabricated", name="Made-up receipts",
           fits=[ToolFit(tool="benford"), ToolFit(tool="isoforest")]),
    Theory(id="weekend", name="Weekend payments",
           fits=[ToolFit(tool="timeseries"), ToolFit(tool="groupby", setting="weekday")]),
    Theory(id="inflated_ratio", name="Costs too big for the deal",
           fits=[ToolFit(tool="regression")]),
    Theory(id="under_limit", name="Just under the approval limit",
           fits=[ToolFit(tool="groupby", setting="vendor"), ToolFit(tool="isoforest")]),
]
THEORY_BY_ID = {t.id: t for t in THEORIES}


def _setting(result: ToolResult) -> str | None:
    params = resolve_params(result.tool_id, result.params)  # a default setting is still a setting
    value = params.get("by", params.get("scope"))
    return None if value is None else str(value)


def fits(result: ToolResult, theory: SchemeId) -> bool:
    return any(f.tool == result.tool_id and f.setting in (None, _setting(result))
               for f in THEORY_BY_ID[theory].fits)


def singles_out(result: ToolResult, suspect: str) -> bool:
    """Names the suspect and at most one other (two fraudsters can share a result)."""
    return suspect in result.implicates and len(result.implicates) <= 2


def proof(suspect: str, theory: SchemeId, clues: list[ToolResult]) -> Proof:
    """Proven: a clue that fits the theory singles them out, or two different tools do.
    Lead: something points at them, but nothing proves it. None: nothing points at them."""
    naming = [c for c in clues if singles_out(c, suspect)]
    if any(fits(c, theory) for c in naming) or len({c.tool_id for c in naming}) >= 2:
        return "proven"
    return "lead" if any(suspect in c.implicates for c in clues) else "none"
