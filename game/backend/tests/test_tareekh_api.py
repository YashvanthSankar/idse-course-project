"""/api/model: the course pipeline project's model, served next to the game."""

import json
import math

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.store import SessionStore
from auditor.tareekh.routes import DATA
from auditor.telemetry import Telemetry


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("AUDITOR_CAREER", "0")
    return TestClient(create_app(store=SessionStore(),
                                 telemetry=Telemetry(str(tmp_path / "t.db"))))


def options(client):
    res = client.get("/api/model/options")
    assert res.status_code == 200, res.text
    return res.json()


def test_options_list_districts_kinds_and_the_notice(client):
    opts = options(client)
    assert "Chennai" in opts["districts"] and len(opts["districts"]) == 33
    assert len(opts["kinds"]) == 40 and opts["months"] == [str(m) for m in range(1, 13)]
    assert any(k["title"] == "Cheque bounce" for k in opts["kinds"])
    topics = {t["id"]: t for t in opts["topics"]}
    assert len(topics) == 13 and topics["cheque"]["default_kind"] in {k["id"] for k in opts["kinds"]}
    assert all(k["topic"] in topics for k in opts["kinds"])
    assert "not legal advice" in opts["notice"] and "ODbL" in opts["credit"]
    assert opts["test"]["n"] == 549_273 and 0.8 < opts["test"]["accuracy"] < 0.82


def test_predict_returns_a_probability_with_effects_and_context(client):
    opts = options(client)
    kind = next(k for k in opts["kinds"] if k["title"] == "Cheque bounce")
    res = client.post("/api/model/predict",
                      json={"district": "Chennai", "kind": kind["id"], "filing_month": 6})
    assert res.status_code == 200, res.text
    body = res.json()
    assert 0 < body["probability"] < 1
    assert body["court_found"] and body["court"]["pending"] > 0
    assert len(body["effects"]) == 12 and all(math.isfinite(e["effect"]) for e in body["effects"])
    assert body["kind"]["topic"] == "cheque" and body["kind"]["timing"]["still_open"]["12"] > 0.5
    assert body["still_open"]["months"]["12"] > 0


def test_two_courts_can_differ_for_the_same_kind_of_case(client):
    kind = options(client)["kinds"][4]["id"]
    p = [client.post("/api/model/predict", json={"district": d, "kind": kind,
                                                 "filing_month": 3}).json()["probability"]
         for d in ("Chennai", "Madurai")]
    assert p[0] != p[1]


@pytest.mark.parametrize("body, status", [
    ({"district": "Atlantis", "kind": "k0", "filing_month": 1}, 404),
    ({"district": "Chennai", "kind": "k999", "filing_month": 1}, 404),
    ({"district": "Chennai", "kind": "k0", "filing_month": 13}, 422),
])
def test_bad_inputs_are_refused(client, body, status):
    assert client.post("/api/model/predict", json=body).status_code == status


def test_a_sample_case_is_scored_exactly_like_the_pipeline_scores_it(client):
    body = client.get("/api/model/sample", params={"seed": 7}).json()
    case = next(c for c in json.loads((DATA / "test_cases.json").read_text())
                if c["id"] == body["case"]["id"])
    inputs = json.loads((DATA / "inputs.json").read_text())
    cols = inputs["categorical"] + inputs["numeric"]
    expected = joblib.load(DATA / "model.joblib").predict_proba(
        pd.DataFrame([{c: case[c] for c in cols}]))[0, 1]
    assert body["probability"] == pytest.approx(expected, abs=1e-12)
    assert body["actual"]["within_1y"] == bool(case["within_1y"])
    assert "ddl_case_id" not in json.dumps(body)  # no case identifiers leave the server


def test_effects_add_up_to_the_model_log_odds(client):
    """effect = contribution - average contribution, so effects + averages + intercept = logit."""
    body = client.get("/api/model/sample", params={"seed": 3}).json()
    model = joblib.load(DATA / "model.joblib")
    inputs = json.loads((DATA / "inputs.json").read_text())
    from auditor.tareekh.routes import predict_row
    case = next(c for c in json.loads((DATA / "test_cases.json").read_text())
                if c["id"] == body["case"]["id"])
    probability, effects = predict_row(case)
    logit = (sum(e["effect"] for e in effects) + sum(inputs["mean_contribution"].values())
             + model.named_steps["model"].intercept_[0])
    assert 1 / (1 + math.exp(-logit)) == pytest.approx(probability, abs=1e-9)


def test_analytics_has_the_charts(client):
    body = client.get("/api/model/analytics").json()
    assert body["national"]["cases"] > 80_000_000
    assert "all cases" in body["tamil_nadu"]["still_open_curves"]
    assert body["model"]["served"].startswith("+ law and section")
