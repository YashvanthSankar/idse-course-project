"""Career rules (CAREER.md §3–§5): ratings, bands, offers, promotion, firing, salary, cameos,
the Final."""

import pytest

from auditor.career.catalog import COMPANIES, TIER_SPECS
from auditor.career.rating import CaseRating, Charge, contract_band, exhibit_points, rate_case
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
    return CaseRating(total=total, caught=culprits if correct else 0, culprits=culprits)


def finish(career, band: str, caught_cameo: bool | None = None):
    """Play out the signed contract so it lands in `band`."""
    total, correct = SCORES[band]
    appraisal = None
    for case in career.contract.cases:
        last = case.index == len(career.contract.cases) - 1
        appraisal = record_case(career, case.index, rating(total, correct, len(case.schemes)),
                                ["zscore"], caught_cameo if last else None)
    return appraisal


def result(tool: str, implicates: list[str], cost: int, params: dict | None = None) -> ToolResult:
    return ToolResult(result_id=f"{tool}-{cost}", tool_id=tool, params=params or {}, title=tool,
                      summary="", figure={}, table=None, code="", stats={},
                      implicates=implicates, cost_charged=cost, budget_left=0)


# ── rating ────────────────────────────────────────────────────────────────────────

def charge(suspect: str, theory: str, clues: list[ToolResult], exhibits: list[str]) -> Charge:
    return Charge(suspect=suspect, theory=theory, clues=clues, exhibits=exhibits)


def parts(r: CaseRating) -> dict[str, float]:
    return {p.name: p.points for p in r.parts}


TWINS = Culprit(fraudster_id="E2", scheme="duplicates", fraud_txn_ids=["T1", "T2", "T3", "T4"],
                catching_tools=["duplicates"], explanation="")


def test_rating_one_fitting_clue_and_the_right_rows_is_a_perfect_case():
    twins = result("duplicates", ["E2"], 2)
    r = rate_case([TWINS], [charge("E2", "duplicates", [twins], ["T1", "T2", "T3"])],
                  spent=2, intended=2, slack=0)
    assert parts(r) == {"Verdict": 35, "Theory": 10, "Proof": 10, "Exhibits": 25,
                        "Spending": 20}
    assert r.total == 100


def test_rating_a_lone_clue_that_doesnt_fit_is_only_a_lead():
    z = result("zscore", ["E2"], 2)
    r = rate_case([TWINS], [charge("E2", "duplicates", [z], ["T1", "T2", "T3"])],
                  spent=2, intended=2, slack=0)
    assert parts(r)["Proof"] == 4


def test_rating_two_different_tools_agreeing_prove_it():
    z, box = result("zscore", ["E2"], 2), result("iqr_box", ["E2"], 2)
    r = rate_case([TWINS], [charge("E2", "weekend", [z, box], ["T1"])],
                  spent=4, intended=2, slack=2)
    assert parts(r)["Proof"] == 10 and parts(r)["Theory"] == 0  # proven, wrong trick named
    assert parts(r)["Spending"] == 20  # the cross-check is free at small firms


def test_rating_settings_matter_for_fit():
    by_vendor = result("groupby", ["E2"], 1, {"by": "vendor"})
    by_category = result("groupby", ["E2"], 1, {"by": "category"})
    limit = Culprit(fraudster_id="E2", scheme="under_limit", fraud_txn_ids=["T1"],
                    catching_tools=["groupby"], explanation="")
    proven = rate_case([limit], [charge("E2", "under_limit", [by_vendor], ["T1"])], 1, 1, 0)
    lead = rate_case([limit], [charge("E2", "under_limit", [by_category], ["T1"])], 1, 1, 0)
    assert parts(proven)["Proof"] == 10 and parts(lead)["Proof"] == 4


def test_rating_exhibits_want_the_fraud_rows_and_only_those():
    assert exhibit_points(["T1", "T2", "T3"], ["T1", "T2", "T3", "T4"]) == 25
    assert exhibit_points(["T1", "T2", "T3", "H1", "H2"], ["T1", "T2", "T3"]) == 15
    assert round(exhibit_points(["T1"], ["T1", "T2", "T3"]), 1) == 8.3
    assert exhibit_points(["T9"], ["T9"]) == 25  # one monster invoice: one row is enough
    assert exhibit_points(["H1"], ["T1"]) == 0


def test_rating_spending_past_the_cross_check_costs_points():
    twins = result("duplicates", ["E2"], 2)
    r = rate_case([TWINS], [charge("E2", "duplicates", [twins], ["T1", "T2", "T3"])],
                  spent=8, intended=2, slack=2)
    assert parts(r)["Spending"] == 10


def test_rating_wrong_suspect_keeps_only_spending():
    misled = result("duplicates", ["E4"], 2)  # a clue that pointed at the wrong person
    r = rate_case([TWINS], [charge("E4", "duplicates", [misled], ["H1"])], 2, 2, 0)
    assert r.total == 20 and r.caught == 0


def test_rating_no_analysis_is_never_exceptional():
    """The free Case Summary names nobody: right guess, right trick, right rows, but no proof
    means no investigation to be thrifty about, so it stays well under every Exceptional bar."""
    summary = result("summary", [], 0)
    r = rate_case([TWINS], [charge("E2", "duplicates", [summary], ["T1", "T2", "T3"])],
                  spent=0, intended=2, slack=0)
    assert parts(r)["Proof"] == 0 and parts(r)["Spending"] == 0
    assert r.total == 70 < min(s.exceptional for s in TIER_SPECS.values())
    # running a cheap tool that names nobody changes nothing
    cheap = result("groupby", [], 1, {"by": "category"})
    r = rate_case([TWINS], [charge("E2", "duplicates", [cheap], ["T1", "T2", "T3"])],
                  spent=1, intended=2, slack=0)
    assert parts(r)["Spending"] == 0


def test_rating_a_clue_naming_two_people_singles_nobody_out_in_a_one_culprit_case():
    box = result("iqr_box", ["E2", "E4"], 2)
    big = Culprit(fraudster_id="E2", scheme="big_invoice", fraud_txn_ids=["T1"],
                  catching_tools=["iqr_box"], explanation="")
    r = rate_case([big], [charge("E2", "big_invoice", [box], ["T1"])], 2, 2, 0)
    assert parts(r)["Proof"] == 4  # a lead: it fits, but it names two people
    a = Culprit(fraudster_id="E2", scheme="big_invoice", fraud_txn_ids=["T1"],
                catching_tools=["iqr_box"], explanation="")
    b = Culprit(fraudster_id="E4", scheme="big_invoice", fraud_txn_ids=["T2"],
                catching_tools=["iqr_box"], explanation="")
    r = rate_case([a, b], [charge("E2", "big_invoice", [box], ["T1"]),
                           charge("E4", "big_invoice", [box], ["T2"])], 2, 2, 0)
    assert parts(r)["Proof"] == 10  # two fraudsters: one result may name both


def test_rating_the_original_of_a_twin_is_a_fair_exhibit():
    twins = result("duplicates", ["E2"], 2)
    # T1, T2 are the copies; O1, O2 the honest originals they copy
    r = rate_case([TWINS], [charge("E2", "duplicates", [twins], ["T1", "O1", "T2", "O2"])],
                  spent=2, intended=2, slack=0, telling={"E2": ["O1", "O2"]})
    assert parts(r)["Exhibits"] == 25
    # but originals alone are not enough: the case still needs as many rows as the fraud left
    r = rate_case([TWINS], [charge("E2", "duplicates", [twins], ["H1", "O1"])],
                  spent=2, intended=2, slack=0, telling={"E2": ["O1"]})
    assert parts(r)["Exhibits"] < 25


def test_rating_two_fraudsters_split_the_verdict():
    a = Culprit(fraudster_id="E1", scheme="duplicates", fraud_txn_ids=["T1"],
                catching_tools=["duplicates"], explanation="")
    b = Culprit(fraudster_id="E3", scheme="fabricated", fraud_txn_ids=["T2"],
                catching_tools=["benford"], explanation="")
    twins, ben = result("duplicates", ["E1"], 2), result("benford", ["E3"], 3)
    r = rate_case([a, b], [charge("E1", "duplicates", [twins], ["T1"]),
                           charge("E5", "fabricated", [ben], ["H1"])], 5, 5, 0)
    assert parts(r)["Verdict"] == 17.5 and r.caught == 1


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


def test_large_firms_set_a_higher_bar():
    assert contract_band([90] * 5, True, True, TIER_SPECS["large"].exceptional) == "good"
    assert contract_band([92] * 5, True, True, TIER_SPECS["large"].exceptional) == "exceptional"
    assert TIER_SPECS["very_large"].exceptional == 90


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


def test_three_good_years_at_one_large_firm_count_as_an_exceptional():
    career = new_career("AAA-AAQ")
    career.offers, career.tier = ["arabian"], "large"
    for year in range(3):
        sign(career, "arabian")
        appraisal = finish(career, "good")
        assert ("arabian" in career.large_exceptional) == (year == 2)
    assert any("count as one exceptional" in e for e in appraisal.events)


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
