"""The senior at each company who hands you their notes on day one (CAREER.md §7.7).

Seniors are never suspects. Their notes are about the company — how honest money moves and what
fooled the last auditor — never about a case. The numbers come from the calibration runs. The
notes fade as you climb: a full page at small firms, one line at the very large ones, and nobody
in the Final."""

from dataclasses import dataclass

from pydantic import BaseModel


@dataclass(frozen=True)
class Senior:
    name: str
    role: str
    look: str  # portrait style, as for roster people
    hello: str  # what they say as they hand the notes over
    notes: tuple[str, ...]


class SeniorNotes(BaseModel):
    name: str
    role: str
    portrait: str
    hello: str
    notes: list[str]
    kit: bool  # show the tool kit with what each tool can prove (small and mid firms)
    proof_rule: bool  # spell out what proves a case (small firms)


PROOF_LINE = ("Before you accuse: name the trick, attach the clue that shows it, then pin the "
              "rows that prove it.")

SENIORS: dict[str, Senior] = {
    # ── Small: a full page ─────────────────────────────────────────────────────────
    "lakshmi": Senior(
        "Sharada Apte", "Family accountant, 30 years", "a",
        "My notes. The last auditor didn't read them.",
        (("We're a sweet shop. Milk, sugar and ghee every morning: small and regular. Diwali "
         "orders are huge, and they're honest."),
         ("Your kit is small. Twin Finder and Box & Whisker can prove a case on their own. "
         "Z-Score only tells you where to look."),
         ("Z-Score flagged an innocent here about one case in twenty. One big bill is a "
         "question, not an answer."))),
    "konkan": Senior(
        "Ganesh Parab", "Accountant", "b",
        "Read these on the bus. You'll need them.",
        (("We run buses. Drivers fill fuel on Sundays and at night. Weekend claims are normal "
         "here, not a crime."),
         ("Z-Score per-person flagged an honest driver in one case out of five last year. One "
         "big fuel bill isn't proof."),
         ("Handwritten receipts get copied. Twin Finder never lies: if it names someone "
         "alone, you've got them."))),
    "pixel": Senior(
        "Meera Sood", "Part-time CFO", "a",
        "The founders won't tell you any of this. I will.",
        ("Founders order dinner at 2 AM. Late-night claims are how we work, not how we steal.",
         ("Z-Score per-person tripped on an honest designer in one case out of five. Big "
         "laptop, honest laptop."),
         ("Pattern Matrix is only as good as what you group by. By vendor it proves a case; by "
         "category it's mostly noise."))),
    # ── Mid: the culture and the trap ──────────────────────────────────────────────
    "sterling": Senior(
        "Cyrus Mody", "Chief Accountant", "b", "Forty years of this firm, on two pages.",
        ("Monday to Friday, strictly. Everyone's Diwali bonus is big, and it's honest.",
         ("Our tools disagree more than most. If a clue doesn't fit your theory, get a second "
         "tool to agree before you accuse."))),
    "bluewave": Senior(
        "Lalitha Raman", "Finance Manager", "a", "Hundreds of reps. Here's how to read them.",
        (("Thousands of small travel and meal claims. Nothing here is big, so don't wait for "
         "big."),
         ("Z-Score per-person still finds the odd honest rep with one large claim. Check it "
         "fits your theory."))),
    "horizon": Senior(
        "Kavita Sahni", "Finance Controller", "a", "About the Chairman. Read this first.",
        (("Mr Khanna signs crore-rupee deals, and his claims are enormous. Honest, just "
         "enormous."),
         ("The last auditor ran Z-Score company-wide and accused him. It flags him in half our "
         "cases and it has been wrong every time. Compare people with their own history."))),
    "malabar": Senior(
        "Joseph Mathew", "Finance Manager", "b", "You'll meet Mr Kurian's bills soon enough.",
        (("Buyer entertainment is huge, and Mr Kurian's bills are the biggest. Diwali bonuses "
         "too."),
         ("Z-Score company-wide points at Mr Kurian in four cases out of ten. It has never once "
         "been right about him."))),
    "saffron": Senior(
        "Rohini Sen", "Finance Manager", "a", "Television keeps strange hours.",
        ("Shoots run on weekends and through the night. That's television, not theft.",
         "Z-Score per-person flagged an innocent in about one case in eight. Back it up.")),
    # ── Large: two lines ───────────────────────────────────────────────────────────
    "arabian": Senior(
        "Farhan Lakdawala", "Head of Internal Audit", "b", "Short notes. You know the job.",
        ("The port never closes: weekend payments are everyday.",
         "Timeline and Z-Score both cry wolf here now and then. Get a second opinion.")),
    "indus": Senior(
        "Prakash Ghatge", "Head of Internal Audit", "b", "One warning, and it's about the MD.",
        ("Mr Bhandari's spending is in a league of its own.",
         "Z-Score company-wide blamed him in more than half our cases. Never trust it alone.")),
    "meridian": Senior(
        "Nandini Bose", "Head of Internal Audit", "a", "We're a quiet ledger. Mostly.",
        ("Open around the clock: weekend claims are everyday.",
         "Our tests rarely cry wolf. When one names someone here, it usually means it.")),
    # ── Very large: one line ───────────────────────────────────────────────────────
    "vasundhara": Senior(
        "Arvind Nair", "Chief Risk Officer", "b", "I don't write long notes.",
        (("The Chairman spends like a small country, and Z-Score will hand you him or an "
         "innocent in four cases out of ten."),)),
    "deccan": Senior(
        "Zarine Batliwala", "Chief Risk Officer", "a", "One line. Make it count.",
        (("Ms Raza entertains every big client herself; Z-Score blamed her or an innocent in "
         "almost half our cases."),)),
    # The Final: nobody. You're the senior now.
}


def notes_for(company_id: str, tier: str) -> SeniorNotes | None:
    senior = SENIORS.get(company_id)
    if senior is None:
        return None
    notes = list(senior.notes) + ([PROOF_LINE] if tier == "small" else [])
    return SeniorNotes(name=senior.name, role=senior.role,
                       portrait=f"{senior.look}-{company_id}-senior", hello=senior.hello,
                       notes=notes, kit=tier in ("small", "mid"), proof_rule=tier == "small")
