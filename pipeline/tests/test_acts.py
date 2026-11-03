"""Spellings below are real values from DDL's act_key.csv."""

import pytest

from tareekh.acts import UNKNOWN, canonical_act, coverage, squash


@pytest.mark.parametrize("raw, law", [
    ("The Indian Penal Code", "Indian Penal Code"),
    ("I.P.C(Police)", "Indian Penal Code"),
    ("IPC CRIMINAL \\", "Indian Penal Code"),
    ("Indian Penal Cod IPC", "Indian Penal Code"),
    ("CRIMINAL CASE UNDER IPC", "Indian Penal Code"),
    ("Ranbir Penal Code", "Ranbir Penal Code"),
    ("Code of Criminal Procedure", "Code of Criminal Procedure"),
    ("Cr. P.C.  \\", "Code of Criminal Procedure"),
    ("CODE OF CIVIL PROCEDURE, 1908 (HB)", "Code of Civil Procedure"),
    ("CodeofCivilProcedure", "Code of Civil Procedure"),
    ("U/O VII RULE 1 OF C P C", "Code of Civil Procedure"),
    ("NegotiableInstrumentsAct", "Negotiable Instruments Act"),
    ("N. I. Act", "Negotiable Instruments Act"),
    ("U/S 138 of N.I Act", "Negotiable Instruments Act"),
    ("MOTOR VEHICLES ACT, 1988", "Motor Vehicles Act"),
    ("IMV ACT", "Motor Vehicles Act"),
    ("U/S 166 OF MV ACT", "Motor Vehicles Act"),
    ("Domestic Voilence Act, 2005", "Domestic Violence Act"),
    ("Protection of Women from Domestic Violence Act", "Domestic Violence Act"),
    ("GUJARAT (BOMBAY) PROHIBITION ACT, 1949", "Prohibition / Excise (state liquor laws)"),
    ("Abkari Act", "Prohibition / Excise (state liquor laws)"),
    ("KP Act", "Police Act (state)"),
    ("Narcotic Drugs and Psychotropic Substances Act", "NDPS Act"),
])
def test_real_spellings_map_to_their_law(raw, law):
    assert canonical_act(raw) == law


def test_a_law_named_inside_another_goes_to_the_specific_one():
    # a dowry case that also cites the IPC is a dowry case, not a liquor-prohibition case
    assert canonical_act("DOWRY PROHIBITION ACT, 1961 ALONG WITH RULES AND RELEVANT "
                         "PROVISIONS OF IPC & EVIDENCE AND CRPC") == "Dowry Prohibition Act"


@pytest.mark.parametrize("raw", [".", "---", "ACT", "Sec.", "OTHERS", "U/s", "''", "", "Under"])
def test_junk_values_are_unknown(raw):
    assert canonical_act(raw) == UNKNOWN


def test_unmatched_laws_are_other_not_guessed():
    assert canonical_act("All-India Council for Technical  Education Act") == "Other"


def test_squash_ignores_case_spacing_punctuation_and_years():
    assert squash("Negotiable Instruments Act  \\ 1881") == squash("NEGOTIABLE INSTRUMENTS ACT")


def test_coverage_weights_by_case_rows():
    cov = coverage(["The Indian Penal Code", ".", "Oaths Act"], [8, 1, 1])
    assert cov == {"named": 0.8, "unknown": 0.1, "other": 0.1}
