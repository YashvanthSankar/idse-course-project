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
