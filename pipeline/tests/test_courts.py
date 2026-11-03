"""Raw values below are real "judge_position" strings from Tamil Nadu's cases."""

import pytest

from tareekh.courts import OTHER, court_level


@pytest.mark.parametrize("raw, level", [
    ("judicial magistrate court", "Magistrate court"),
    ("judicial mgistrate, sulur", "Magistrate court"),
    ("12-metropolitan magistrate court", "Magistrate court"),
    ("district munsiff first class", "Munsif court"),
    ("principal district musif court complex, thoothukud", "Munsif court"),
    ("pdm, i adm, ii adm tirunelveli", "Munsif court"),
    ("subardinate court jayankondam", "Sub court (subordinate judge)"),
    ("sub-ordinate judge,ponneri", "Sub court (subordinate judge)"),
    ("3-additional district and sessions court", "District / sessions judge"),
    ("city civil and sessions court", "District / sessions judge"),
    ("special court for the exclusive trail of ec act cases",
     "Special court: corruption / CBI / economic"),
    ("spl. court for prevn. of corruption act case,vpm",
     "Special court: corruption / CBI / economic"),
    ("special court to deal with mcop, coimbatore", "Motor accident claims tribunal"),
    ("magalir neethi mandram fast track theni", "Special court: women (Mahila)"),
    ("spl magistarte for land grabbing cases", "Special court: land grabbing"),
    ("principal ndps", "Special court: POCSO / SC-ST / NDPS"),
    ("family court", "Family court"),
    ("small cause court", "Small cause court"),
])
def test_real_court_names_map_to_their_level(raw, level):
    assert court_level(raw) == level


def test_an_unreadable_code_is_unclear_not_guessed():
    assert court_level("svgmmdpdm") == OTHER
    assert court_level("") == OTHER
