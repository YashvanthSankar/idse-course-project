import pytest

from auditor.generator.cases import build_case
from auditor.interrogation import THEMES, statements


@pytest.mark.parametrize("level", range(1, 7))
def test_every_suspect_has_a_statement(level):
    case = build_case(level, 3)
    lines = statements(case)
    assert set(lines) == {s.id for s in case.meta.suspects}
    assert all(isinstance(t, str) and len(t) > 15 for t in lines.values())


@pytest.mark.parametrize("level", range(1, 7))
def test_the_fraudster_lies_about_their_own_scheme(level):
    case = build_case(level, 5)
    lines = statements(case)
    assert lines[case.truth.fraudster_id] in THEMES[case.truth.scheme]


@pytest.mark.parametrize("level", range(1, 7))
def test_words_alone_cannot_identify_the_fraudster(level):
    case = build_case(level, 8)
    lines = statements(case)
    on_theme = [sid for sid, t in lines.items() if t in THEMES[case.truth.scheme]]
    assert len(on_theme) >= 3  # the liar hides among people making true claims about the same thing


def test_statements_are_stable_for_a_case():
    case = build_case(2, 11)
    assert statements(case) == statements(build_case(2, 11))


def test_interrogation_route(tmp_path):
    from fastapi.testclient import TestClient

    from auditor.api import create_app
    from auditor.store import SessionStore
    from auditor.telemetry import Telemetry

    client = TestClient(create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "i.db"))))
    meta = client.post("/api/cases", json={"level": 2, "seed": 4}).json()
    sid = meta["suspects"][0]["id"]
    res = client.get(f"/api/cases/{meta['case_id']}/interrogate/{sid}")
    assert res.status_code == 200 and len(res.json()["statement"]) > 15
    budget = client.get(f"/api/cases/{meta['case_id']}").json()["budget_left"]
    assert budget == meta["budget_left"]  # questioning is free
    assert client.get(f"/api/cases/{meta['case_id']}/interrogate/E9").status_code == 404
