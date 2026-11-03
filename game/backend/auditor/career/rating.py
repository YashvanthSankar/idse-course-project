"""The career rating (CAREER.md §3): 0–100 per case, a band per contract.

Quick Case and Class Mode never touch this module — they keep the 1000-point score."""

from pydantic import BaseModel

from auditor.career.catalog import Band
from auditor.career.proof import THEORY_BY_ID, proof
from auditor.models import Culprit, SchemeId, ToolResult

VERDICT, THEORY, FLAG, EXHIBITS, SPENDING = 35, 10, 10, 25, 20
FLAG_POINTS = {"proven": FLAG, "lead": 4, "none": 0}
MAX_EXHIBITS = 5
EXHIBITS_NEEDED = 3  # rows that show the trick (fewer when the fraud left fewer)


class RatingPart(BaseModel):
    name: str
    points: float
    out_of: int
    reason: str


class CaseRating(BaseModel):
    total: float
    parts: list[RatingPart] = []  # verdict, theory, proof, exhibits, spending
    caught: int  # culprits caught
    culprits: int


class Charge(BaseModel):
    """One accusation as the rating sees it."""

    suspect: str
    theory: SchemeId
    clues: list[ToolResult]
    exhibits: list[str]  # txn ids


def exhibit_points(picked: list[str], fraud_rows: list[str],
                   telling: list[str] | None = None) -> float:
    """Every row you pick should show the trick (precision), and you need enough of them
    (recall). `telling` = rows that show it besides the fraud itself, e.g. the honest original
    of a bill billed twice: pinning it is fair, since the pair is the evidence."""
    if not picked:
        return 0.0
    hits = len(set(picked) & (set(fraud_rows) | set(telling or ())))
    needed = min(EXHIBITS_NEEDED, len(fraud_rows))
    return EXHIBITS * hits / len(picked) * min(1.0, hits / needed)


def rate_case(culprits: list[Culprit], charges: list[Charge], spent: int, intended: int,
              slack: int, telling: dict[str, list[str]] | None = None) -> CaseRating:
    """`spent` = coins used in the case; `intended` = what the intended tools cost; `slack` =
    coins you may spend on top without losing points (a cross-check, more at small firms);
    `telling` = per fraudster, the rows besides the fraud that also show the trick."""
    n = len(culprits)
    telling = telling or {}
    by_suspect = {c.suspect: c for c in charges}
    caught = [c for c in culprits if c.fraudster_id in by_suspect]

    theory = flag = exhibits = 0.0
    named, proven, rows_hit, rows_pinned, rows_needed = 0, 0, 0, 0, 0
    for c in caught:
        charge = by_suspect[c.fraudster_id]
        named += charge.theory == c.scheme
        theory += THEORY * (charge.theory == c.scheme) / n
        level = proof(c.fraudster_id, charge.theory, charge.clues, n)
        proven += level == "proven"
        flag += FLAG_POINTS[level] / n
        shows = set(c.fraud_txn_ids) | set(telling.get(c.fraudster_id, ()))
        points = exhibit_points(charge.exhibits, c.fraud_txn_ids, sorted(shows))
        rows_hit += len(set(charge.exhibits) & shows)
        rows_pinned += len(charge.exhibits)
        rows_needed += min(EXHIBITS_NEEDED, len(c.fraud_txn_ids))
        exhibits += points / n
    verdict = VERDICT * len(caught) / n
    # Efficiency only counts for an investigation: an accusation no clue points at earns none
    backed = sum(proof(ch.suspect, ch.theory, ch.clues, n) != "none" for ch in charges)
    allowed = intended + slack
    efficiency = min(1.0, allowed / spent) if spent else 1.0
    spending = SPENDING * efficiency * backed / max(1, len(charges))

    who = "both fraudsters" if n == 2 and len(caught) == 2 else (
        "one of the two" if n == 2 and caught else "the right suspect" if caught else
        "the wrong suspect")
    tricks = " and ".join(THEORY_BY_ID[c.scheme].name.lower() for c in culprits)
    named_right = {c.scheme for c in caught if by_suspect[c.fraudster_id].theory == c.scheme}
    right = " and ".join(THEORY_BY_ID[s].name.lower() for s in named_right)
    missed = " and ".join(THEORY_BY_ID[c.scheme].name.lower() for c in culprits
                          if c.scheme not in named_right)
    parts = [
        RatingPart(name="Verdict", points=round(verdict, 1), out_of=VERDICT,
                   reason=f"You accused {who}."),
        # Reasons follow the points: full marks only when every culprit earned them
        RatingPart(name="Theory", points=round(theory, 1), out_of=THEORY, reason=(
            f"You named the trick: {tricks}." if named == n else
            f"You named {named} of the {n} tricks ({right}); the other was {missed}." if named else
            f"The trick was {tricks}." if caught else "A theory about the wrong person.")),
        RatingPart(name="Proof", points=round(flag, 1), out_of=FLAG, reason=(
            "A clue that fits your theory singled them out." if proven == n
            else f"Proven against {proven} of the {n}; the rest is a lead at best." if proven
            else "Only a lead: no clue that fits your theory, and no second tool agreeing."
            if caught else "Clues against the wrong person prove nothing.")),
        RatingPart(name="Exhibits", points=round(exhibits, 1), out_of=EXHIBITS, reason=(
            f"{rows_hit} of the {rows_pinned} rows you pinned show the trick (the case needed "
            f"{rows_needed}). Every honest row you pin lowers the score, and so does pinning "
            "fewer fraud rows than needed." if caught else
            "The rows you pinned were honest.")),
        RatingPart(name="Spending", points=round(spending, 1), out_of=SPENDING, reason=(
            "No clue you filed points at who you accused, so there was no investigation to "
            "be thrifty about." if not backed else
            f"You spent {spent} coins; the case needed {intended}"
            + (f", and a cross-check of up to {slack} is free." if slack else ".")
            + (" One accusation had no clue pointing at them." if backed < len(charges) else "")
            if spent else "You solved it without spending a coin.")),
    ]
    return CaseRating(total=round(sum(p.points for p in parts), 1), parts=parts,
                      caught=len(caught), culprits=n)


def contract_band(ratings: list[float], all_correct: bool, hard_solved: bool,
                  exceptional: int = 88) -> Band:
    """Exceptional at the tier's bar (and the hard case solved) · Good 70+ · OK 60+ · Bad below.
    Every suspect right is never Bad: you can only be fired for wrong accusations."""
    average = sum(ratings) / len(ratings)
    if average >= exceptional and hard_solved:
        return "exceptional"
    if average >= 70:
        return "good"
    if average >= 60 or all_correct:
        return "ok"
    return "bad"
