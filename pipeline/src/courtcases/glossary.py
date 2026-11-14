"""Plain-English names for the codes visitors see on the site.

Only well-established meanings are listed. Anything not listed is shown as its raw code
rather than guessed; check each entry before quoting it in the report (JEEVA.md, task 7).
"""

# Tamil Nadu district-court case types (DDL's type_name, lower-cased)
CASE_TYPES = {
    "os": "Original suit (civil)",
    "as": "Appeal suit (civil appeal)",
    "cc": "Calendar case (criminal trial before a magistrate)",
    "stc": "Summary trial case (petty offences)",
    "sc": "Sessions case (serious criminal trial)",
    "spl.sc": "Special sessions case",
    "prc": "Preliminary register case (before committal to sessions)",
    "crlmp": "Criminal miscellaneous petition (bail and similar)",
    "crla": "Criminal appeal",
    "mcop": "Motor accident claim",
    "ep": "Execution petition (enforcing a decree)",
    "ep_mcop": "Execution of a motor accident award",
    "hmop": "Hindu marriage petition",
    "op": "Original petition",
    "mc": "Maintenance case",
    "dvc": "Domestic violence case",
    "rcop": "Rent control petition",
    "rca": "Rent control appeal",
    "cma": "Civil miscellaneous appeal",
    "id": "Industrial dispute",
    "laop": "Land acquisition petition",
    "ip": "Insolvency petition",
    "tr.op": "Transfer petition",
    "gwop": "Guardianship petition",
    "arbop": "Arbitration petition",
    "other": "Other case types",
}

# (canonical law, primary section) -> what that section is about
SECTIONS = {
    ("Negotiable Instruments Act", "138"): "cheque bounce",
    ("Motor Vehicles Act", "166"): "accident compensation claim",
    ("Motor Vehicles Act", "140"): "no-fault accident compensation",
    ("Motor Vehicles Act", "185"): "drunk driving",
    ("Motor Vehicles Act", "177"): "general traffic offence",
    ("Motor Vehicles Act", "129"): "riding without a helmet",
    ("Indian Penal Code", "279"): "rash driving",
    ("Indian Penal Code", "302"): "murder",
    ("Indian Penal Code", "304A"): "death by negligence",
    ("Indian Penal Code", "304B"): "dowry death",
    ("Indian Penal Code", "307"): "attempt to murder",
    ("Indian Penal Code", "323"): "causing hurt",
    ("Indian Penal Code", "324"): "hurt with a weapon",
    ("Indian Penal Code", "326"): "grievous hurt with a weapon",
    ("Indian Penal Code", "337"): "hurt by a rash act",
    ("Indian Penal Code", "338"): "grievous hurt by a rash act",
    ("Indian Penal Code", "354"): "assault on a woman",
    ("Indian Penal Code", "379"): "theft",
    ("Indian Penal Code", "380"): "theft in a house",
    ("Indian Penal Code", "392"): "robbery",
    ("Indian Penal Code", "420"): "cheating",
    ("Indian Penal Code", "498A"): "cruelty by husband or in-laws",
    ("Indian Penal Code", "506"): "criminal intimidation",
    ("Code of Criminal Procedure", "125"): "maintenance for wife, children or parents",
    ("Code of Criminal Procedure", "437"): "bail",
    ("Code of Criminal Procedure", "438"): "anticipatory bail",
    ("Code of Criminal Procedure", "439"): "bail (sessions court)",
    ("Code of Civil Procedure", "Order 7"): "civil suit (plaint)",
    ("Code of Civil Procedure", "Order 21"): "execution of a decree",
    ("Code of Civil Procedure", "Order 37"): "summary suit (money)",
    ("Prohibition / Excise (state liquor laws)", "4"): "liquor offence",
    ("Hindu Marriage Act", "13"): "divorce",
    ("Hindu Marriage Act", "13B"): "divorce by mutual consent",
    ("Hindu Marriage Act", "9"): "restitution of conjugal rights",
}


def case_type_name(code: str) -> str:
    return CASE_TYPES.get(code, code.upper())


def section_name(law: str, section: str) -> str | None:
    return SECTIONS.get((law, section))


# The site's first question, "what is the case about?", in everyday words. Each kind of case
# (case type + court + law + section) belongs to the first topic whose test matches.
TOPICS = [
    {"id": "cheque", "icon": "💳", "title": "Cheque bounce",
     "about": "A cheque someone gave you bounced"},
    {"id": "accident", "icon": "🚗", "title": "Road accident compensation",
     "about": "Claiming money after a road accident"},
    {"id": "traffic", "icon": "🚦", "title": "Drunk driving or traffic offence",
     "about": "Charged with a driving or vehicle offence"},
    {"id": "rash", "icon": "🚑", "title": "Rash driving that hurt someone",
     "about": "A careless driver injured someone"},
    {"id": "divorce", "icon": "💔", "title": "Divorce", "about": "Ending a Hindu marriage"},
    {"id": "theft", "icon": "👜", "title": "Theft", "about": "Something was stolen"},
    {"id": "threats", "icon": "⚠️", "title": "Threats or intimidation",
     "about": "Someone threatened or intimidated a person"},
    {"id": "bail", "icon": "🔓", "title": "Bail", "about": "Asking a court to release someone"},
    {"id": "liquor", "icon": "🥃", "title": "Liquor offence",
     "about": "Selling or carrying liquor illegally"},
    {"id": "civil", "icon": "🏠", "title": "Property or money dispute",
     "about": "Suing someone over land, money or a deal"},
    {"id": "execution", "icon": "📜", "title": "Enforcing a court order",
     "about": "Getting a court's decision carried out"},
    {"id": "appeal", "icon": "⚖️", "title": "Civil appeal",
     "about": "Challenging a civil court's decision"},
    {"id": "other", "icon": "🗂️", "title": "Other criminal case",
     "about": "Other police and criminal cases"},
]

# How each topic reads in a sentence ("cheque-bounce cases")
TOPIC_NOUN = {
    "cheque": "cheque-bounce cases", "accident": "accident-compensation claims",
    "traffic": "traffic-offence cases", "rash": "rash-driving injury cases",
    "divorce": "divorce cases", "theft": "theft cases", "threats": "intimidation cases",
    "bail": "bail applications", "liquor": "liquor cases", "civil": "civil suits",
    "execution": "cases enforcing a court order", "appeal": "civil appeals",
    "other": "criminal cases of this kind",
}

COURT_PLAIN = {
    "Magistrate court": "magistrate court",
    "District / sessions judge": "district court",
    "Sub court (subordinate judge)": "sub court",
    "Munsif court": "munsif court",
    "Small cause court": "small causes court",
}

CASE_TYPE_PLAIN = {
    "stc": "quick summary trial", "cc": "full criminal trial", "mcop": "claim petition",
    "crlmp": "petition", "os": "civil suit", "ep": "execution petition",
    "hmop": "marriage petition", "as": "appeal",
}


def topic_of(case_type: str, law: str, law_section: str) -> str:
    section = law_section.split(" s.", 1)[1] if " s." in law_section else ""
    if law == "Negotiable Instruments Act":
        return "cheque"
    if law == "Motor Vehicles Act":
        return "accident" if case_type == "mcop" else "traffic"
    if case_type == "crlmp":
        return "bail"
    if law == "Indian Penal Code" and section in {"279", "338", "337", "304A"}:
        return "rash"
    if law == "Hindu Marriage Act":
        return "divorce"
    if law == "Indian Penal Code" and section in {"379", "380"}:
        return "theft"
    if law == "Indian Penal Code" and section == "506":
        return "threats"
    if law.startswith("Prohibition"):
        return "liquor"
    if case_type == "os":
        return "civil"
    if case_type == "ep":
        return "execution"
    if case_type == "as":
        return "appeal"
    return "other"


def variant_label(case_type: str, court_level: str) -> str:
    """How a variant within a topic reads: "full criminal trial · magistrate court"."""
    return (f"{CASE_TYPE_PLAIN.get(case_type, case_type_name(case_type).lower())} · "
            f"{COURT_PLAIN.get(court_level, court_level.lower())}")


# The stage recorded at a case's latest hearing, in everyday words
PURPOSE_PLAIN = {
    "evidence": "Taking evidence",
    "issue": "Framing the issues / issuing process",
    "service pending": "Summons or notice not yet served",
    "enquiry": "Enquiry",
    "ia / ea pending / cmp pending / crp pending / cma pending": "A side application is pending",
    "trial": "Trial",
    "counter": "Waiting for the other side's reply",
    "argument": "Arguments",
    "appearance": "Waiting for parties to appear",
    "steps": "Waiting for a party to act",
}
