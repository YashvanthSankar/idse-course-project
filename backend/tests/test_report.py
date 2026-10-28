"""The downloadable case file has one page for each stage of the reveal."""

import pytest

from auditor.generator.cases import build_case
from auditor.models import ToolResult
from auditor.report import render_report
from auditor.scoring import score_accusation
from auditor.store import CaseSession
from auditor.tools.registry import TOOLS, run_tool


def case_session(level: int, *, with_verdict: bool = True) -> CaseSession:
    bundle = build_case(level, seed=42)
    session = CaseSession(bundle=bundle, budget_left=bundle.meta.budget, started_at=0)
    if with_verdict:
        names = {s.id: s.name for s in bundle.meta.suspects}
        evidence = []
        for number, tool_id in enumerate(("summary", "groupby"), start=1):
            analysis, figure, code = run_tool(tool_id, bundle.df, {}, names)
            result = ToolResult(
                result_id=f"result-{number}", tool_id=tool_id, params={},
                title=analysis.title, summary=analysis.summary, figure=figure,
                table=None, code=code, stats={}, implicates=analysis.implicates,
                cost_charged=TOOLS[tool_id].cost, budget_left=session.budget_left,
            )
            evidence.append(result)
            session.results[result.result_id] = result
        session.verdict = score_accusation(
            bundle.truth, bundle.meta.suspects, bundle.truth.fraudster_id,
            evidence, session.budget_left,
        )
    return session


def test_report_is_pdf():
    pdf = render_report(case_session(1))
    assert pdf.startswith(b"%PDF")
    assert pdf.count(b"/Type /Page") - pdf.count(b"/Type /Pages") == 3


def test_report_requires_verdict():
    with pytest.raises(ValueError):
        render_report(case_session(1, with_verdict=False))


@pytest.mark.parametrize("level", range(1, 7))
def test_all_schemes_render(level):
    assert render_report(case_session(level)).startswith(b"%PDF")
