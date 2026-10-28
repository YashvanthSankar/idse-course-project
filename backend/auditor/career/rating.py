"""The career rating (CAREER.md §3): 0–100 per case, a band per contract.

Quick Case and Class Mode never touch this module — they keep the 1000-point score."""

from pydantic import BaseModel

from auditor.career.catalog import Band
from auditor.models import Culprit, ToolId, ToolResult
from auditor.scoring import grade_evidence

VERDICT, EVIDENCE, JUDGMENT, EFFICIENCY = 40, 25, 20, 15
# Evidence: your best clue should come from a tool that catches this fraud (15); the second
# should back it up (10). Most frauds have only one catching tool, so the second clue can't
# also be "strong" — corroboration from another tool counts in full.
BEST = {"strong": 15, "supportive": 7.5, "weak": 3, "irrelevant": 0}
BACKUP = {"strong": 10, "supportive": 10, "weak": 4, "irrelevant": 0}
ORDER = ["strong", "supportive", "weak", "irrelevant"]


class RatingPart(BaseModel):
    points: float
    out_of: int
    reason: str


class CaseRating(BaseModel):
    total: float
    verdict: RatingPart
    evidence: RatingPart
    judgment: RatingPart
    efficiency: RatingPart
    caught: int  # culprits caught
    culprits: int


def rate_case(
    culprits: list[Culprit],
    accusations: list[tuple[str, list[ToolResult]]],
    results: list[ToolResult],
    spent: int,
    intended: int,
) -> CaseRating:
    """`accusations` = (suspect id, filed clues) per accused; `spent` = coins used in the case
    (tools and Hacker Mode); `intended` = what the intended tools cost."""
    n = len(culprits)
    accused = {suspect: clues for suspect, clues in accusations}
    caught = [c for c in culprits if c.fraudster_id in accused]

    verdict = VERDICT * len(caught) / n
    evidence = 0.0
    backed = 0
    for c in caught:
        grades = sorted((grade_evidence(r, c.fraudster_id, c.catching_tools).grade
                         for r in accused[c.fraudster_id]), key=ORDER.index)
        points = BEST[grades[0]] if grades else 0
        if len(grades) > 1:
            points += BACKUP[grades[1]]
            backed += BACKUP[grades[1]] == 10
        evidence += points / n

    catching: set[ToolId] = {t for c in culprits for t in c.catching_tools}
    on_target = sum(r.cost_charged for r in results if r.tool_id in catching)
    judgment = JUDGMENT * on_target / spent if spent else 0.0
    efficiency = EFFICIENCY * min(1.0, intended / spent) if spent else 0.0

    who = "both fraudsters" if n == 2 and len(caught) == 2 else (
        "one of the two" if n == 2 and caught else "the right suspect" if caught else
        "the wrong suspect")
    strong = sum(any(grade_evidence(r, c.fraudster_id, c.catching_tools).grade == "strong"
                     for r in accused[c.fraudster_id]) for c in caught)
    return CaseRating(
        total=round(verdict + evidence + judgment + efficiency, 1),
        verdict=RatingPart(points=round(verdict, 1), out_of=VERDICT,
                           reason=f"You accused {who}."),
        evidence=RatingPart(points=round(evidence, 1), out_of=EVIDENCE, reason=(
            ("Your best clue came from a tool that catches this fraud" if strong == len(caught)
             else "Your best clue wasn't from a tool that catches this fraud")
            + ("; the second backed it up." if backed == len(caught) else
               "; the second didn't back it up.")
            if caught else "Evidence against the wrong person doesn't count.")),
        judgment=RatingPart(points=round(judgment, 1), out_of=JUDGMENT, reason=(
            f"{on_target} of your {spent} coins went on tools that fit this fraud."
            if spent else "You didn't run a single tool.")),
        efficiency=RatingPart(points=round(efficiency, 1), out_of=EFFICIENCY, reason=(
            f"The intended tool{'s' if n == 2 else ''} cost {intended}; you spent {spent}."
            if spent else "No analysis, no efficiency.")),
        caught=len(caught),
        culprits=n,
    )


def contract_band(ratings: list[float], all_correct: bool, hard_solved: bool) -> Band:
    """Exceptional 88+ (and the hard case solved) · Good 70–87 · OK 60–69 · Bad below 60.
    Every suspect right is never Bad: you can only be fired for wrong accusations."""
    average = sum(ratings) / len(ratings)
    if average >= 88 and hard_solved:
        return "exceptional"
    if average >= 70:
        return "good"
    if average >= 60 or all_correct:
        return "ok"
    return "bad"
