"""A contract mixes its frauds, and the people you've caught never stand in a lineup again."""

from collections import Counter
from itertools import pairwise

import numpy as np
import pytest
from fastapi.testclient import TestClient

from auditor.api import create_app
from auditor.career.cases import plan_contract, without_convicted
from auditor.career.catalog import COMPANIES, TIER_SPECS
from auditor.career.people import company_people
from auditor.career.storage import CareerStore
from auditor.store import SessionStore
from auditor.telemetry import Telemetry
from tests.test_career_api import play_case


@pytest.mark.parametrize("company_id", [c for c in COMPANIES if COMPANIES[c].tier != "final"])
def test_one_method_cant_carry_a_contract(company_id):
    company = COMPANIES[company_id]
    for seed in range(30):
        plans = plan_contract(company, np.random.default_rng(seed))
        assert plans[0].schemes == (company.signature,)
        counts = Counter(s for p in plans for s in p.schemes)
        cases = sum(len(p.schemes) for p in plans)
        fair = -(-cases // len(company.schemes))  # the most any scheme needs, spread evenly
        assert max(counts.values()) <= fair, (company_id, [p.schemes for p in plans])
        for before, after in pairwise(plans):
            assert not set(before.schemes) & set(after.schemes), [p.schemes for p in plans]


def test_the_convicted_are_dropped_until_the_staff_runs_short():
    people = company_people("pixel", ["tara"])
    staff = [p.key for p in people if not p.is_head and not p.cameo]
    assert {p.key for p in without_convicted(people, staff[:3], "pixel")}.isdisjoint(staff[:3])
    # caught nearly everyone: a full lineup of staff is kept, the oldest catches come back
    kept = without_convicted(people, staff, "pixel")
    left = [p for p in kept if not p.is_head and not p.cameo]
    assert len(left) == TIER_SPECS["small"].suspects
    assert {p.key for p in left} == set(staff[:len(left)])
    assert any(p.cameo == "tara" for p in kept)


def test_caught_fraudsters_leave_the_lineup(tmp_path):
    careers = CareerStore(str(tmp_path / "t.db"))
    app = create_app(store=SessionStore(), telemetry=Telemetry(str(tmp_path / "t.db")),
                     careers=careers)
    client = TestClient(app)
    code = client.post("/api/career", json={"player_id": "p1"}).json()["code"]
    client.post(f"/api/career/{code}/sign", json={"company_id": "pixel"})
    for _ in range(4):
        play_case(app, client, code)
        client.post(f"/api/career/{code}/case")  # open the next one
        career = careers.get(code)
        assert career.convicted
        lineup = next(c for c in career.contract.cases if c.rating is None).lineup
        assert lineup and not set(lineup) & set(career.convicted)
    play_case(app, client, code)
    assert len(careers.get(code).convicted) == 5  # one fraudster a case, all caught
