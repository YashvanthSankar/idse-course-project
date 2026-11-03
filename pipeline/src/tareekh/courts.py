"""Reduce the free-text "judge position" (116 values in Tamil Nadu alone, with place names
and typos: "special court for the exclusive trail of ec act cases", "district musif",
"subardinate court", "judicial mgistrate") to the level of court that heard the case.

The level matters for duration: a magistrate's petty-case docket and a district judge's
sessions trials run at very different speeds. Rules run on the lower-cased text, most specific
first: special courts are named for what they try, so "special court ... prevention of
corruption" must not fall into a generic district-judge bucket.
"""

import re
from functools import cache

RULES: list[tuple[str, str]] = [
    ("Special court: women (Mahila)", r"mahila|magalir|mahalir|ftmc"),
    ("Special court: POCSO / SC-ST / NDPS", r"pocso|\bsc\s*st\b|ndps|atrocit"),
    ("Special court: corruption / CBI / economic",
     r"corruption|vigil|\bcbi\b|economic off|\bpc act\b|tnpid|\bec act\b|\bec court\b|essential"),
    ("Special court: land grabbing", r"land grab"),
    ("Motor accident claims tribunal", r"mcop|motor accident"),  # before the generic "special"
    ("Special court: other", r"special|spl\.?\s|fast track|bomb blast|forest|exclusive tri"),
    ("Family court", r"family"),
    ("Labour / industrial court", r"labour|industrial"),
    ("Small cause court", r"small cause"),
    ("Commercial court", r"commercial"),
    ("District / sessions judge",
     r"district (?:and|&) sessions|district judge|sessions|city civil|\badj\b"),
    ("Sub court (subordinate judge)",
     r"\bsub\b|sub[\s.-]*ordinate|subardinate|sub judge|sub court|\bsj\b|prmsj"),
    ("Munsif court", r"mun?sif|munsiff|musif|\bdm\b|\bpdm\b|\badm\b"),
    ("Magistrate court", r"magistrate|magistarte|mgistrate|magistrat|\bjm\b|\bcjm\b"),
]
_COMPILED = [(name, re.compile(pattern)) for name, pattern in RULES]
OTHER = "Other / unclear"


@cache
def court_level(judge_position: str) -> str:
    text = re.sub(r"\s+", " ", (judge_position or "").lower()).strip()
    for name, pattern in _COMPILED:
        if pattern.search(text):
            return name
    return OTHER
