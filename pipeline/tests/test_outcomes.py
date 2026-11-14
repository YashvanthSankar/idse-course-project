from courtcases.outcomes import ENDS_CASE, OUTCOME_GROUP, outcome_group

# All 52 categories in DDL's disp_name_key.csv (2010–2018)
DDL_DISPOSITIONS = """
disposition var missing|dismissed|allowed|disposed|acquitted|transferred|referred to lok adalat|
convicted|fine|judgement|other|disposed-otherwise|withdrawn|reject|plead guilty|decided|
compromise|closed|confession|otherwise|disposal in lok adalat|plea bargaining|committed|
procedural|award|258 crpc|settled|abated|ex-parte|untrace|converted|probation|absconded|
bail granted|sine die|compounded|not press|cancelled|partly decreed|bail refused|quash|
p.o. consign|remanded|bail rejected|contest-allowed|died|appeal accepted|uncontested|stayed|
prison|execution|bail order"""


def test_every_ddl_category_has_a_deliberate_group():
    categories = {c.strip() for c in DDL_DISPOSITIONS.replace("\n", "").split("|")}
    assert len(categories) == 52
    assert categories == set(OUTCOME_GROUP)


def test_moving_to_another_court_does_not_end_a_case():
    for moved in ("transferred", "committed", "remanded", "referred to lok adalat"):
        assert outcome_group(moved) == "moved"
        assert outcome_group(moved) not in ENDS_CASE


def test_lok_adalat_referral_and_lok_adalat_disposal_differ():
    assert outcome_group("referred to lok adalat") == "moved"
    assert outcome_group("disposal in lok adalat") == "settled"


def test_bail_orders_are_side_applications():
    assert {outcome_group(b) for b in ("bail granted", "bail refused", "bail rejected")} == {
        "interim"}


def test_lookup_is_forgiving_about_case_and_space_but_not_guessing():
    assert outcome_group("  Convicted ") == "decided"
    assert outcome_group("something new") == "missing"
    assert outcome_group(None) == "missing"
