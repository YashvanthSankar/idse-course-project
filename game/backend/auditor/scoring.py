"""Verdicts and points (DESIGN.md §2.1)."""

from auditor.models import (
    CaseTruth,
    EvidenceGrade,
    Suspect,
    ToolId,
    ToolResult,
    Verdict,
)

BASE = 1000
POINTS = {"strong": 250, "supportive": 100, "weak": 0, "irrelevant": -100}
BUDGET_POINT = 40  # every coin you didn't need: careful analysis beats running everything


def grade_evidence(result: ToolResult, accused: str, catching_tools: list[ToolId]) -> EvidenceGrade:
    if accused not in result.implicates:
        grade = "irrelevant"
    elif len(result.implicates) > 2:
        grade = "weak"  # it points at half the company, so it proves little
    elif result.tool_id in catching_tools:
        grade = "strong"
    else:
        grade = "supportive"
    return EvidenceGrade(result_id=result.result_id, tool_id=result.tool_id, grade=grade,
                         points=POINTS[grade])


def score_accusation(
    truth: CaseTruth,
    suspects: list[Suspect],
    accused: str,
    evidence: list[ToolResult],
    budget_left: int,
) -> Verdict:
    grades = [grade_evidence(r, accused, truth.catching_tools) for r in evidence]
    correct = accused == truth.fraudster_id
    if correct:
        breakdown = {
            "base": BASE,
            "evidence": sum(g.points for g in grades),
            "budget_bonus": BUDGET_POINT * budget_left,
        }  # no time bonus: there's no clock, take the time to think
    else:
        breakdown = {"base": 0, "evidence": 0, "budget_bonus": 0}
    return Verdict(
        correct=correct,
        score=max(0, sum(breakdown.values())),
        breakdown=breakdown,
        fraudster=next(s for s in suspects if s.id == truth.fraudster_id),
        scheme=truth.scheme,
        explanation=truth.explanation,
        fraud_txn_ids=truth.fraud_txn_ids,
        catching_tools=truth.catching_tools,
        accused_id=accused,
        evidence=grades,
    )
