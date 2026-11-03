"""What does each of DDL's 52 disposition categories mean for "how long did the case take"?

The categories mix final outcomes with things that are not the end of a case. The question we
model is *how long until the case is finished in this court*, so each category gets a group:

- decided:   a ruling on the merits (convicted, acquitted, allowed, judgement …)
- settled:   the parties ended it (compromise, Lok Adalat disposal, withdrawn, compounded …)
- dismissed: thrown out or ended without a ruling (dismissed, rejected, abated, died …)
- disposed:  the court recorded it as disposed without saying how ("disposed", "other" …)
- dormant:   closed in the records but not resolved (sine die, accused absconding or untraced,
             file consigned while the accused is a proclaimed offender, stayed)
- moved:     continues somewhere else (transferred, committed to a Sessions court, remanded,
             referred to a Lok Adalat, converted into another case)
- interim:   a bail order: bail applications are side-applications, not cases
- missing:   "disposition var missing", which is mostly still-pending cases

For durations: decided / settled / dismissed / disposed / dormant **end** the case in this
court. **moved** is treated as censored at that date: the case didn't finish, it left. Courts
report dormant files as disposed, so they count as ending; analyses that want "resolved" can
drop the dormant group.

Bail applications must be excluded by **case type** (known at filing), never by this outcome,
or the model would be selecting cases using information from their future.
"""

OUTCOME_GROUP: dict[str, str] = {
    # decided on the merits
    "convicted": "decided", "acquitted": "decided", "allowed": "decided",
    "judgement": "decided", "decided": "decided", "fine": "decided", "plead guilty": "decided",
    "confession": "decided", "probation": "decided", "partly decreed": "decided",
    "ex-parte": "decided", "contest-allowed": "decided", "uncontested": "decided",
    "appeal accepted": "decided", "award": "decided", "prison": "decided", "quash": "decided",
    "execution": "decided",
    # ended by the parties
    "compromise": "settled", "settled": "settled", "disposal in lok adalat": "settled",
    "withdrawn": "settled", "compounded": "settled", "plea bargaining": "settled",
    "not press": "settled",
    # ended without a ruling
    "dismissed": "dismissed", "reject": "dismissed", "abated": "dismissed",
    "died": "dismissed", "cancelled": "dismissed", "closed": "dismissed",
    "258 crpc": "dismissed",  # CrPC s.258: the magistrate stops the proceedings
    # disposed, manner not recorded
    "disposed": "disposed", "disposed-otherwise": "disposed", "other": "disposed",
    "otherwise": "disposed", "procedural": "disposed",
    # closed in the records, not resolved
    "sine die": "dormant", "p.o. consign": "dormant", "absconded": "dormant",
    "untrace": "dormant", "stayed": "dormant",
    # continues elsewhere
    "transferred": "moved", "committed": "moved", "remanded": "moved",
    "referred to lok adalat": "moved", "converted": "moved",
    # side-applications
    "bail granted": "interim", "bail refused": "interim", "bail rejected": "interim",
    "bail order": "interim",
    # no disposition recorded
    "disposition var missing": "missing",
}

ENDS_CASE = frozenset({"decided", "settled", "dismissed", "disposed", "dormant"})


def outcome_group(disposition: str | None) -> str:
    """The group for a decoded disposition label; unknown labels are "missing"."""
    return OUTCOME_GROUP.get((disposition or "").strip().lower(), "missing")
