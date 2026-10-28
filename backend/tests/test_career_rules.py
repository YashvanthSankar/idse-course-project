"""Career rules (CAREER.md §3–§5): ratings, bands, offers, promotion, firing, salary, cameos,
the Final."""

import pytest

from auditor.career.catalog import COMPANIES, TIER_SPECS
from auditor.career.rating import CaseRating, RatingPart, contract_band, rate_case
from auditor.career.rules import (
    CareerError,
    appraise,
    new_career,
    record_case,
    sign,
)
from auditor.models import Culprit, ToolResult

SCORES = {"exceptional": (95, True), "good": (78, True), "ok": (62, True),
          "bad": (20, False)}


def rating(total: float, correct: bool, culprits: int = 1) -> CaseRating:
    part = RatingPart(points=0, out_of=0, reason="")
    return CaseRating(total=total, verdict=part, evidence=part, judgment=part, efficiency=part,
                      caught=culprits if correct else 0, culprits=culprits)


def finish(career, band: str, caught_cameo: bool | None = None):
    """Play out the signed contract so it lands in `band`."""
    total, correct = SCORES[band]
    appraisal = None
    for case in career.contract.cases:
        last = case.index == len(career.contract.cases) - 1
        appraisal = record_case(career, case.index, rating(total, correct, len(case.schemes)),
                                ["zscore"], caught_cameo if last else None)
    return appraisal


def result(tool: str, implicates: list[str], cost: int) -> ToolResult:
    return ToolResult(result_id=f"{tool}-{cost}", tool_id=tool, params={}, title=tool,
                      summary="", figure={}, table=None, code="", stats={},
                      implicates=implicates, cost_charged=cost, budget_left=0)


# ── rating ────────────────────────────────────────────────────────────────────────

def test_rating_straight_to_the_right_tool_is_exceptional():
    culprit = Culprit(fraudster_id="E2", scheme="duplicates", fraud_txn_ids=[],
                      catching_tools=["duplicates"], explanation="")
    twins, summary = result("duplicates", ["E2"], 2), result("summary", [], 0)
    r = rate_case([culprit], [("E2", [twins, summary])], [twins, summary], spent=2, intended=2)
    assert (r.verdict.points, r.evidence.points, r.judgment.points, r.efficiency.points) == (
        40, 15, 20, 15)
    assert r.total == 90


def test_rating_a_detour_costs_judgment_and_efficiency():
    culprit = Culprit(fraudster_id="E2", scheme="big_invoice", fraud_txn_ids=[],
                      catching_tools=["zscore", "iqr_box"], explanation="")
    z, box = result("zscore", ["E2"], 2), result("iqr_box", ["E2"], 2)
    r = rate_case([culprit], [("E2", [z, box])], [z, box], spent=4, intended=2)
    assert r.total == 92.5  # both tools fit the fraud: confirming costs only efficiency
    detour = result("benford", [], 2)
    r = rate_case([culprit], [("E2", [z, detour])], [z, detour], spent=4, intended=2)
    assert r.judgment.points == 10 and r.efficiency.points == 7.5


def test_rating_wrong_suspect_keeps_only_tool_points():
    culprit = Culprit(fraudster_id="E2", scheme="duplicates", fraud_txn_ids=[],
                      catching_tools=["duplicates"], explanation="")
    twins = result("duplicates", ["E2"], 2)
    r = rate_case([culprit], [("E4", [twins])], [twins], spent=2, intended=2)
    assert r.verdict.points == 0 and r.evidence.points == 0 and r.total == 35


def test_rating_two_fraudsters_split_the_verdict():
    a = Culprit(fraudster_id="E1", scheme="duplicates", fraud_txn_ids=[],
                catching_tools=["duplicates"], explanation="")
    b = Culprit(fraudster_id="E3", scheme="fabricated", fraud_txn_ids=[],
                catching_tools=["benford"], explanation="")
    twins, ben = result("duplicates", ["E1"], 2), result("benford", ["E3"], 3)
    r = rate_case([a, b], [("E1", [twins]), ("E5", [ben])], [twins, ben], spent=5, intended=5)
    assert r.verdict.points == 20 and r.caught == 1


@pytest.mark.parametrize(("ratings", "correct", "hard", "band"), [
    ([95, 92, 90, 88, 90], True, True, "exceptional"),
    ([95, 92, 90, 88, 90], True, False, "good"),  # the hard case must be solved
    ([75, 72, 80, 70, 71], True, True, "good"),
    ([65, 60, 62, 61, 64], True, True, "ok"),
    ([55, 50, 52, 51, 54], True, True, "ok"),  # every suspect right is never Bad
    ([95, 95, 95, 20, 20], False, False, "ok"),
    ([95, 20, 15, 30, 25], False, False, "bad"),
])
def test_contract_bands(ratings, correct, hard, band):
    assert contract_band(ratings, correct, hard) == band


# ── offers, promotion, salary ─────────────────────────────────────────────────────

def test_a_new_career_has_three_small_offers_and_a_hidden_culprit():
    career = new_career("AAA-AAA")
    assert sorted(career.offers) == ["konkan", "lakshmi", "pixel"]
    assert career.final_culprit in {"imran", "tara", "meher"}
    assert career.salary == 6.0


def test_first_company_brings_all_three_old_colleagues():
    career = new_career("AAA-AAB")
    contract = sign(career, "lakshmi")
    assert sorted(contract.cameos) == ["imran", "meher", "tara"]
    assert all(g.last_company is None for g in contract.greetings)
    assert len(contract.cases) == 5 and contract.cases[-1].difficulty == "hard"


def test_good_at_small_brings_mid_offers_and_a_raise():
    career = new_career("AAA-AAC")
    sign(career, "lakshmi")
    appraisal = finish(career, "good")
    assert appraisal.band == "good" and career.salary == 9.0
    assert any(COMPANIES[o].tier == "mid" for o in career.offers)
    assert career.year == 2 and career.status == "offers"


def test_exceptional_at_small_also_brings_a_large_offer():
    career = new_career("AAA-AAD")
    sign(career, "konkan")
    finish(career, "exceptional")
    tiers = {COMPANIES[o].tier for o in career.offers}
    assert {"mid", "large"} <= tiers and career.salary == 12.0


def test_salary_stops_at_the_tier_ceiling():
    career = new_career("AAA-AAE")
    for company in ["lakshmi", "lakshmi", "lakshmi"]:
        career.offers.append(company)
        sign(career, company)
        finish(career, "exceptional")
    assert career.salary == TIER_SPECS["small"].ceiling == 15.0


def test_bad_then_bad_again_gets_you_fired_from_a_small_firm():
    career = new_career("AAA-AAF")
    sign(career, "pixel")
    first = finish(career, "bad")
    assert "pixel" in career.offers and "start over" in first.events[0]
    sign(career, "pixel")
    finish(career, "bad")
    assert career.companies["pixel"].banned and "pixel" not in career.offers
    assert career.offers and career.salary == 6.0


def test_two_goods_at_different_mid_firms_open_the_large_companies():
    career = new_career("AAA-AAG")
    career.offers = ["sterling", "bluewave", "horizon"]
    career.tier = "mid"
    sign(career, "sterling")
    finish(career, "good")
    assert not any(COMPANIES[o].tier == "large" for o in career.offers)
    sign(career, "bluewave")
    finish(career, "ok")  # an OK pauses the streak
    assert career.mid_good == ["sterling"]
    sign(career, "horizon")
    finish(career, "good")
    assert any(COMPANIES[o].tier == "large" for o in career.offers)


def test_fired_from_mid_drops_you_to_small_and_resets_the_streak():
    career = new_career("AAA-AAH")
    career.offers, career.tier, career.salary = ["sterling", "bluewave"], "mid", 15.0
    sign(career, "bluewave")
    finish(career, "good")
    career.offers.append("sterling")
    for _ in range(2):
        if "sterling" not in career.offers:
            career.offers.append("sterling")
        sign(career, "sterling")
        finish(career, "bad")
    assert career.tier == "small" and career.salary == 6.0 and career.mid_good == []
    assert all(COMPANIES[o].tier == "small" for o in career.offers)


def test_promotion_pays_the_new_base():
    career = new_career("AAA-AAI")
    career.offers = ["arabian"]
    sign(career, "arabian")
    assert career.salary == 40.0 and career.tier == "large"


def test_exceptional_at_two_large_then_both_very_large_reaches_the_final():
    career = new_career("AAA-AAJ")
    career.offers, career.tier = ["arabian", "indus"], "large"
    for company in ["arabian", "indus"]:
        sign(career, company)
        finish(career, "exceptional")
    assert {"vasundhara", "deccan"} <= set(career.offers)
    for company in ["vasundhara", "deccan"]:
        sign(career, company)
        finish(career, "exceptional")
    assert "kaveri" in career.offers


def test_practice_replays_earn_nothing():
    career = new_career("AAA-AAK")
    sign(career, "lakshmi")
    finish(career, "good")
    salary, offers = career.salary, list(career.offers)
    sign(career, "lakshmi", practice=True)
    appraisal = finish(career, "exceptional")
    assert appraisal.practice and career.salary == salary and career.offers == offers
    with pytest.raises(CareerError):
        sign(career, "deccan", practice=True)  # never worked there


# ── cameos ────────────────────────────────────────────────────────────────────────

def test_cameos_remember_only_the_last_company_you_shared():
    career = new_career("AAA-AAL")
    sign(career, "lakshmi")
    finish(career, "good")
    assert all(career.cameo_last[c] == "lakshmi" for c in ("imran", "tara", "meher"))
    mid = next(o for o in career.offers if COMPANIES[o].tier == "mid")
    contract = sign(career, mid)
    assert 1 <= len(contract.cameos) <= 2
    for greeting in contract.greetings:
        assert "Lakshmi Sweets" in greeting.line and greeting.last_company
        assert career.cameo_weights[greeting.cameo] == 0.5  # less likely next time
    finish(career, "good")
    for c in contract.cameos:
        assert career.cameo_last[c] == mid
        assert [s.company_id for s in career.cameo_trail[c]] == ["lakshmi", mid]


def test_the_final_has_all_three_and_the_last_case_hides_the_culprit():
    career = new_career("AAA-AAM")
    career.offers, career.tier = ["kaveri"], "very_large"
    contract = sign(career, "kaveri")
    assert sorted(contract.cameos) == ["imran", "meher", "tara"]
    assert [c.difficulty for c in contract.cases] == ["very_hard"] * 3
    assert contract.cases[-1].forced_cameo == career.final_culprit
    assert all(c.forced_cameo is None for c in contract.cases[:-1])


@pytest.mark.parametrize(("caught", "ending"), [(True, "caught"), (False, "escaped")])
def test_the_final_is_played_once_and_ends_the_story(caught, ending):
    career = new_career("AAA-AAN")
    career.offers, career.tier, career.salary = ["kaveri"], "very_large", 200.0
    sign(career, "kaveri")
    finish(career, "good", caught_cameo=caught)
    assert career.ending == ending and career.status == "ended"
    assert career.salary == (500.0 if caught else 200.0)
    assert career.title == ("Chief Auditor" if caught else None)
    with pytest.raises(CareerError):
        career.offers.append("kaveri")
        sign(career, "kaveri")


def test_appraise_is_only_reached_after_every_case():
    career = new_career("AAA-AAO")
    sign(career, "lakshmi")
    assert record_case(career, 0, rating(90, True), []) is None
    assert career.status == "contract"
    with pytest.raises(AttributeError):
        appraise(new_career("AAA-AAP"))
