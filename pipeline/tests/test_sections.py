"""Strings below are real section values from Tamil Nadu's acts_sections rows."""

import pytest

from courtcases.sections import primary_section


@pytest.mark.parametrize("raw, section", [
    ("506", "506"),
    ("302", "302"),
    ("304(B)", "304B"),
    ("498A", "498A"),
    ("138", "138"),
    ("138,142", "138"),
    ("138NIAct", "138"),
    ("138N.I.Act", "138"),
    ("138r/w142", "138"),
    ("138 NI ACT", "138"),
    ("U/S 138 of N.I Act", "138"),
    ("166(1)(a)", "166"),
    ("185,3r/w181", "185"),
    ("US166", "166"),
    ("4(1)(a)TNPAct", "4"),
    ("4(i)(k)", "4"),
    ("Order7Rule1", "Order 7"),
    ("OVIIR1", "Order 7"),
    ("O7R1", "Order 7"),
    ("Or7R1", "Order 7"),
    ("U.O.21R.43and64", "Order 21"),
    ("Order37Rule1", "Order 37"),
    ("OrderVIIRule1ofCPC", "Order 7"),
    ("27(c)", "27C"),
])
def test_real_section_strings(raw, section):
    assert primary_section(raw) == section


@pytest.mark.parametrize("raw", ["", "---", ".", "TNP", "0"])
def test_nothing_usable_is_blank(raw):
    assert primary_section(raw) == ""
