"""Map the ~30,000 raw law names in the eCourts data to a few dozen canonical laws.

The raw names are typed by court staff: "The Indian Penal Code", "I.P.C(Police)",
"IPC CRIMINAL \\", "Indian Penal Cod IPC", "NegotiableInstrumentsAct", "U/S 138 of N.I Act" …
Each name is "squashed" (lower case, letters only) so spacing, punctuation, years and stray
backslashes stop mattering, then the first matching rule wins. Rules are ordered from the most
specific to the most general, because names overlap: "Dowry Prohibition Act … IPC" is a dowry
case, not a liquor-prohibition or an IPC case.

Every rule is a decision we defend in the viva, and `coverage()` reports how many case rows
the rules map, so the cost of each rule is measurable.
"""

import re
from functools import cache

# (canonical name, regex on the squashed name). First match wins.
RULES: list[tuple[str, str]] = [
    # specific laws that mention a general one in their name
    ("Dowry Prohibition Act", r"dowry"),
    ("Domestic Violence Act", r"domesticvi?o[il]|protectionofwomen|^pwdva?|dvact"),
    ("POCSO Act", r"pocso|protectionofchildrenfromsexual|childrenfromsexualoffen"),
    ("SC/ST Atrocities Act", r"atrocit|scheduledcastes?andscheduledtribes?|^scst|^sc/?st"),
    ("Prevention of Corruption Act", r"preventionofcorruption|^pcact$|^pc$|corruptionact"),
    ("Juvenile Justice Act", r"juvenile"),
    ("Ranbir Penal Code", r"ranbir|^rpc$"),  # Jammu & Kashmir's penal code, not the IPC
    # the big three procedural and penal codes
    ("Indian Penal Code", r"indianpenal|penalcod|ipc|^ip$"),  # "Criminal case under IPC"
    ("Code of Criminal Procedure", r"criminalprocedure|codeofcrim|crpc|^cr(?:p|i)?c$|^crimpc"),
    ("Code of Civil Procedure",
     r"civilprocedure|codeofcivil|^civilpc|cpc"),  # also "Order 7 Rule 1 of CPC"
    # high-volume special laws
    ("Negotiable Instruments Act",
     r"negotiab|negotiat|^niact|^ni$|ofniact|niactsec|nisact|^nia$|chequebounce|^usofni"),
    ("Motor Vehicles Act", r"motorveh|motorvech|motorvichel|mvact|^mv$|^imv"),  # "U/S 166 MV Act"
    ("Hindu Marriage Act", r"hindumarri|^hmact|^hma$|hindumarr"),
    ("Special Marriage Act", r"specialmarriage"),
    ("Divorce Act", r"divorce"),
    ("Family Courts Act", r"familycourt"),
    ("Guardians and Wards Act", r"guardian"),
    ("Hindu Succession / Indian Succession Act", r"succession"),
    ("Hindu Adoptions and Maintenance Act", r"hinduadoption"),
    ("Maintenance (CrPC 125 / Senior Citizens)", r"maintenance"),
    ("NDPS Act", r"ndps|narcotic|psychotropic"),
    ("Arms Act", r"^armsact|^arms$|^armsac|indianarms"),
    ("Explosive Substances Act", r"explosive"),
    ("Prohibition / Excise (state liquor laws)",
     r"prohibition|excise|abkari|liquor|maltliquor|^akbari|^abakari|opium"),
    ("Gambling Act (state)", r"gambling|gaming|lottery|lotteries"),
    ("Police Act (state)", r"policeact|^police$|citypolice|policeordinance|^kpact$|^kp$"),
    ("Electricity Act", r"electricity"),
    ("Railways Act", r"railway"),
    ("Forest / Wildlife Act", r"forest|wildlife"),
    ("Mines and Minerals Act", r"mines|mineral"),
    ("Essential Commodities Act", r"essentialcommod"),
    ("Food Safety / Adulteration Act", r"adulteration|foodsafety"),
    ("Registration of Births and Deaths Act", r"birthsanddeaths|birthanddeath|birthsdeaths"),
    ("Transfer of Property Act", r"transferofproperty"),
    ("Specific Relief Act", r"specificrelief"),
    ("Rent Control Act (state)", r"rent|tenancy|leasesand|accommodationcontrol"),
    ("Land Acquisition Act", r"landacquisition"),
    ("Arbitration and Conciliation Act", r"arbitration"),
    ("Indian Contract Act", r"contractact|indiancontract"),
    ("Court Fees and Suits Valuation Act", r"courtfee|suitsvaluation"),
    ("Muslim personal law", r"muslim|shariat"),
    ("Payment and Settlement Systems Act", r"paymentandsettlement"),  # e-payment "bounces"
    ("Money recovery suit", r"recoveryofmoney|moneysuit|moneyrecovery"),
    ("Limitation Act", r"limitation"),
    ("Indian Evidence Act", r"evidence"),
    ("Industrial Disputes Act", r"industrialdispute"),
    ("Workmen's Compensation Act", r"workmen|employeescompensation"),
    ("Payment of Wages / Labour laws", r"paymentofwages|minimumwages|labour|factoriesact"),
    ("Mental Health / Lunacy Act", r"lunacy|mentalhealth"),
    ("Consumer Protection Act", r"consumerprotection"),
    ("Income Tax Act", r"incometax"),
    ("Municipal / Local bodies Act", r"municipal|panchayat|corporationact|^bmcact$|^mmcact$"),
    ("Bombay Regulation Act, 1827", r"bombayregulation"),
    ("Absorbed Areas (Laws) Act", r"absorbedareas"),
]
_COMPILED = [(name, re.compile(pattern)) for name, pattern in RULES]

UNKNOWN = "Unknown / not recorded"
# Values that carry no information: ".", "---", "ACT", "NA", "Other", "0"
_JUNK = re.compile(r"^(?:|act|acts|na|nil|none|other|others|otherlaw|otheract|null|section|"
                   r"sec|us|usec|u|s|x|under|all|civilcases|criminalcases|thecode|code|"
                   r"theact|law|a|actusec)$")


def squash(raw: str) -> str:
    return re.sub(r"[^a-z]", "", (raw or "").lower())


@cache
def canonical_act(raw: str) -> str:
    """The canonical law for one raw name; "Other" when no rule matches."""
    key = squash(raw)
    if _JUNK.match(key):
        return UNKNOWN
    for name, pattern in _COMPILED:
        if pattern.search(key):
            return name
    return "Other"


def coverage(names, counts) -> dict:
    """Share of case rows mapped to a named law, to Unknown and to Other."""
    totals = {"named": 0.0, "unknown": 0.0, "other": 0.0}
    for raw, n in zip(names, counts, strict=True):
        act = canonical_act(raw)
        bucket = "unknown" if act == UNKNOWN else "other" if act == "Other" else "named"
        totals[bucket] += n
    whole = sum(totals.values()) or 1.0
    return {k: v / whole for k, v in totals.items()}
