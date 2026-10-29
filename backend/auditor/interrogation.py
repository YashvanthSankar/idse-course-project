"""Interrogations: every suspect makes a statement. The fraudster lies about exactly what they
did, while innocent suspects make similar claims that are true, so only the data can tell
them apart. Which statement is checkable with which tool is the hint."""

import random
import zlib

from auditor.generator.cases import CaseBundle
from auditor.models import SchemeId

# Claims about each scheme's behaviour. True for the innocent, a lie from the fraudster.
THEMES: dict[SchemeId, list[str]] = {
    "big_invoice": [
        "My claims are routine. Nothing I file is ever out of the ordinary.",
        "I've never put in a bill that big — check my history, it's all small stuff.",
        "Every invoice I file looks like the last one. I'm boring like that.",
    ],
    "duplicates": [
        "I'd never submit the same receipt twice. I keep a spreadsheet.",
        "Every dinner I claim happened exactly once, I promise you.",
        "Double billing? I'm the one who catches other people doing that.",
    ],
    "fabricated": [
        "Every amount I claim comes straight off a real receipt.",
        "I don't round, I don't guess. The numbers are the numbers.",
        "Made-up figures? I'd have to be stupid. It's all printed bills.",
    ],
    "weekend": [
        "Weekends? Office is shut. I'm with my family, not the company card.",
        "I hardly ever claim anything on a Saturday or Sunday.",
        "My card stays in the drawer from Friday night to Monday morning.",
    ],
    "inflated_ratio": [
        "My expenses always match the size of the deals I bring in.",
        "I spend in proportion. Small client, small dinner. Big client, big dinner.",
        "Look at my margins — they're as tight as anyone's in sales.",
    ],
    "under_limit": [
        "I only pay vendors the whole team knows. No strangers on my books.",
        "Nothing I approve goes anywhere near the ₹50,000 limit.",
        "I'm in bed by eleven. I don't approve payments in the middle of the night.",
    ],
}

# Off-topic alibis: colour, never evidence.
ALIBIS = [
    "Ask anyone on my floor — I'm the most careful person here.",
    "I was at my cousin's wedding in Pune half of September. Check the photos.",
    "The CEO signs off on everything I do. Talk to him.",
    "I've been here eleven years. Why would I throw that away now?",
    "You auditors always come after the people who actually work.",
]


def statements(case: CaseBundle) -> dict[str, str]:
    """One line per suspect, stable for a given case."""
    truth = case.truth
    names = "|".join(s.name for s in case.meta.suspects)
    rng = random.Random(zlib.crc32(f"{case.meta.briefing}|{names}".encode()))
    suspects = [s.id for s in case.meta.suspects]
    theme = THEMES.get(truth.scheme) if truth.scheme else None

    if theme is None:  # an honest company: everyone tells the truth, in their own way
        pool = rng.sample(ALIBIS, len(suspects))
        return dict(zip(suspects, pool, strict=True))

    innocents = [s for s in suspects if s != truth.fraudster_id]
    rng.shuffle(innocents)
    # The liar plus two innocents make claims about the scheme's behaviour; the rest give alibis.
    claimers = [truth.fraudster_id, *innocents[:2]]
    claims = rng.sample(theme, len(claimers))
    lines = dict(zip(claimers, claims, strict=True))
    for sid, alibi in zip(innocents[2:], rng.sample(ALIBIS, len(innocents) - 2), strict=True):
        lines[sid] = alibi
    return {sid: lines[sid] for sid in suspects}
