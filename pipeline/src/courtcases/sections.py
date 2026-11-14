"""The main section a case was filed under, from the free-text section field.

Measured in Tamil Nadu: 493 distinct IPC section strings, 2,454 for the Negotiable
Instruments Act ("138", "138,142", "138NIAct", "138r/w142", "138 NI ACT" …), 24,310 for the
Motor Vehicles Act, 61,776 for civil procedure ("Order7Rule1", "OVIIR1", "O7R1", "Or7R1"). The
first section number decides what the case is about (IPC 302 murder vs 379 theft vs 498A
cruelty; NI Act 138 cheque bounce; MV Act 166 accident claim vs 185 drunk driving), so we keep
the first section and its letter suffix, and Order N for civil-procedure orders.
"""

import re
from functools import cache

_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50}
_ORDER = re.compile(r"\bO(?:RDER|RD|R)?\s*\.?\s*([0-9]{1,2}|[IVXL]{1,7})\s*\.?\s*R", re.IGNORECASE)
_PREFIX = re.compile(r"^\s*(?:U\s*/?\s*S\.?|UNDER\s+SECTION|SECTIONS?|SECS?\.?|S\.)\s*", re.IGNORECASE)
# A suffix is either a bracketed letter, 304(B), but not a lower-case Roman sub-clause like
# 4(1)(i), or a letter glued to the number, 498A, but not the start of an abbreviation such as
# "138N.I.Act" or "138r/w142" (letter followed by "." or "/")
_FIRST = re.compile(r"(\d{1,4})(?:\s*\(\s*([A-HJ-UWYZa-hj-uwyz]|[IVX])\s*\)|([A-Za-z])(?![A-Za-z./]))?")


def _roman(text: str) -> int | None:
    total, prev = 0, 0
    for ch in reversed(text.upper()):
        value = _ROMAN.get(ch)
        if value is None:
            return None
        total = total - value if value < prev else total + value
        prev = max(prev, value)
    return total or None


@cache
def primary_section(raw: str) -> str:
    """'302', '498A', '138', 'Order 7', or '' when nothing usable is recorded."""
    text = (raw or "").strip()
    if not text or not re.search(r"[0-9IVXL]", text, re.IGNORECASE):
        return ""
    if order := _ORDER.search(text):
        number = order.group(1)
        value = int(number) if number.isdigit() else _roman(number)
        if value:
            return f"Order {value}"
    text = _PREFIX.sub("", text)
    match = _FIRST.search(text)
    if not match:
        return ""
    suffix = (match.group(2) or match.group(3) or "").upper()
    return match.group(1).lstrip("0") + suffix if match.group(1).strip("0") else ""
