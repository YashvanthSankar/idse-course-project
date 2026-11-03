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

# Off-topic alibis: colour, never evidence. At least as many as the biggest lineup (the Final's ten).
ALIBIS = [
    "Ask anyone on my floor — I'm the most careful person here.",
    "I was at my cousin's wedding in Pune half of September. Check the photos.",
    "The CEO signs off on everything I do. Talk to him.",
    "I've been here eleven years. Why would I throw that away now?",
    "You auditors always come after the people who actually work.",
    "I take the 7:40 local every morning and leave at six. My life is very small.",
    "Finance approves my claims before I even see them. Ask them.",
    "I've got two kids in school and a home loan. I can't afford trouble.",
    "I flagged a dodgy vendor myself last year. Look it up.",
    "Honestly? I don't even like spending the company's money. Too much paperwork.",
    "My manager reviews every rupee. If something's wrong, it got past both of us.",
    "Check my desk, check my phone. I've got nothing to hide.",
]


def statements(case: CaseBundle) -> dict[str, str]:
    """One line per suspect, stable for a given case. The seed mixes in the (hidden) fraud rows,
    so knowing the public briefing and names is not enough to replay the draw offline."""
    truth = case.truth
    culprits = truth.culprits() if truth.fraudster_id and truth.scheme else []
    hidden = ",".join(t for c in culprits for t in c.fraud_txn_ids)
    names = "|".join(s.name for s in case.meta.suspects)
    rng = random.Random(zlib.crc32(f"{case.meta.briefing}|{names}|{hidden}".encode()))
    suspects = [s.id for s in case.meta.suspects]
    guilty = {c.fraudster_id for c in culprits}
    innocents = [s for s in suspects if s not in guilty]
    rng.shuffle(innocents)

    lines: dict[str, str] = {}
    # Each fraudster lies about their own scheme, and two innocents make true claims on the
    # same theme, so the words alone never single the liar out.
    for culprit in culprits:
        theme = THEMES[culprit.scheme]
        honest = [s for s in innocents if s not in lines][:2]
        for sid, claim in zip([culprit.fraudster_id, *honest],
                              rng.sample(theme, min(len(theme), 1 + len(honest))), strict=False):
            lines[sid] = claim
    rest = [s for s in suspects if s not in lines]
    alibis = rng.sample(ALIBIS, min(len(rest), len(ALIBIS)))
    for i, sid in enumerate(rest):
        lines[sid] = alibis[i % len(alibis)]
    return {sid: lines[sid] for sid in suspects}
