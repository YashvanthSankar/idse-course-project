import pytest

from auditor.models import CaseTruth, Suspect, ToolResult
from auditor.scoring import grade_evidence, score_accusation

SUSPECTS = [Suspect(id=f"E{i}", name=f"S{i}", role="r", department="d", bio="b", portrait="b01")
            for i in range(1, 6)]
TRUTH = CaseTruth(fraudster_id="E2", scheme="big_invoice", fraud_txn_ids=["T00007"],
                  catching_tools=["zscore", "iqr_box"], herrings=["ceo"], explanation="x")


def result(rid, tool, implicates):
    return ToolResult(result_id=rid, tool_id=tool, params={}, title="t", summary="s", figure={},
                      table=None, code="", stats={}, implicates=implicates, cost_charged=1,
                      budget_left=1)


STRONG = result("r1", "zscore", ["E2"])
STRONG2 = result("r2", "iqr_box", ["E2"])


def test_perfect_score():
    v = score_accusation(TRUTH, SUSPECTS, "E2", [STRONG, STRONG2], budget_left=4)
    assert v.correct
    assert v.score == 1660
    assert v.breakdown == {"base": 1000, "evidence": 500, "budget_bonus": 160}
    assert [g.grade for g in v.evidence] == ["strong", "strong"]


def test_wrong_suspect_scores_zero():
    v = score_accusation(TRUTH, SUSPECTS, "E3", [STRONG, STRONG2], budget_left=4)
    assert not v.correct and v.score == 0
    assert v.fraudster.id == "E2" and v.explanation == "x"
    assert v.fraud_txn_ids == ["T00007"]


@pytest.mark.parametrize(("res", "grade", "points"), [
    (result("a", "zscore", ["E2"]), "strong", 250),
    (result("b", "groupby", ["E2"]), "supportive", 100),
    (result("c", "zscore", ["E1", "E2", "E3"]), "weak", 0),
    (result("d", "zscore", ["E4"]), "irrelevant", -100),
    (result("e", "summary", []), "irrelevant", -100),
])
def test_grades(res, grade, points):
    g = grade_evidence(res, "E2", ["zscore", "iqr_box"])
    assert (g.grade, g.points, g.result_id, g.tool_id) == (grade, points, res.result_id,
                                                           res.tool_id)


def test_no_time_pressure():
    v = score_accusation(TRUTH, SUSPECTS, "E2", [STRONG, STRONG2], budget_left=0)
    assert "time_bonus" not in v.breakdown  # take your time: learning beats speed


def test_score_with_irrelevant_evidence():
    bad = [result("x", "zscore", ["E4"]), result("y", "zscore", ["E5"])]
    v = score_accusation(TRUTH, SUSPECTS, "E2", bad, budget_left=0)
    assert v.score == 800


def test_wrong_suspect_still_grades_evidence():
    v = score_accusation(TRUTH, SUSPECTS, "E4", [STRONG, result("z", "zscore", ["E4"])], 0)
    assert [g.grade for g in v.evidence] == ["irrelevant", "strong"]
    assert v.score == 0
