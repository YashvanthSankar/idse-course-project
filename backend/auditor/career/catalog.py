"""Everything fixed about a career: tiers, salaries, the fourteen companies and the three
old colleagues who follow you through them (docs/CAREER.md §2, §5, §7)."""

from dataclasses import dataclass, field
from typing import Literal

from auditor.generator.base import Culture
from auditor.models import HerringId, SchemeId, ToolId

Tier = Literal["small", "mid", "large", "very_large", "final"]
Difficulty = Literal["easy", "medium", "hard", "very_hard"]
Band = Literal["exceptional", "good", "ok", "bad"]

TIERS: list[Tier] = ["small", "mid", "large", "very_large", "final"]
TIER_NAMES: dict[Tier, str] = {"small": "Small", "mid": "Mid", "large": "Large",
                               "very_large": "Very large", "final": "The Final"}

SMALL_TOOLS: list[ToolId] = ["summary", "groupby", "zscore", "iqr_box", "duplicates"]
MID_TOOLS: list[ToolId] = SMALL_TOOLS + ["benford", "timeseries", "regression"]
ALL_TOOLS: list[ToolId] = MID_TOOLS + ["isoforest"]


@dataclass(frozen=True)
class TierSpec:
    rows: int  # transactions in a ledger
    suspects: int  # suspects per case
    tools: list[ToolId]
    tool_level: int  # the Quick Case level whose tool list matches (for the frontend kit)
    base: float  # salary, in lakh rupees a year
    hikes: dict[Band, float]  # yearly raise by contract result
    ceiling: float  # salary can't pass the next tier's base: move up to earn more
    plan: tuple[Difficulty, ...]  # the cases of one contract
    exceptional: int = 88  # the contract average for Exceptional (calibrated by bots, §10)
    slack: int = 0  # coins you may spend past the intended tools for free (a cross-check)
    hard_spare: int | None = None  # spare coins on the hard case, when tighter than the usual 2


FIVE: tuple[Difficulty, ...] = ("easy", "easy", "medium", "medium", "hard")
TIER_SPECS: dict[Tier, TierSpec] = {
    "small": TierSpec(1000, 5, SMALL_TOOLS, 2, 6.0,
                      {"bad": 0, "ok": 0.20, "good": 0.50, "exceptional": 1.00}, 15.0, FIVE,
                      slack=2),
    "mid": TierSpec(1500, 5, MID_TOOLS, 5, 15.0,
                    {"bad": 0, "ok": 0.10, "good": 0.25, "exceptional": 0.50}, 40.0, FIVE,
                    slack=2),
    "large": TierSpec(2500, 5, ALL_TOOLS, 6, 40.0,
                      {"bad": 0, "ok": 0.10, "good": 0.20, "exceptional": 0.30}, 150.0, FIVE,
                      exceptional=92, slack=1, hard_spare=1),
    "very_large": TierSpec(3500, 7, ALL_TOOLS, 6, 150.0,
                           {"bad": 0, "ok": 0.10, "good": 0.15, "exceptional": 0.25}, 500.0,
                           ("easy", "easy", "medium", "hard", "very_hard"), exceptional=90),
    "final": TierSpec(5000, 10, ALL_TOOLS, 7, 500.0, {"bad": 0, "ok": 0, "good": 0,
                                                      "exceptional": 0}, 500.0,
                      ("very_hard", "very_hard", "very_hard")),
}
ROSTER_SIZE = 20  # every company's own people; cameos join on top


@dataclass(frozen=True)
class Company:
    id: str
    name: str
    city: str
    industry: str
    tier: Tier
    letter: str  # the offer letter: why they called the Bureau
    culture_note: str  # one line on how honest money moves here
    signature: SchemeId  # the fraud this company's easy cases are about
    schemes: tuple[SchemeId, ...]  # every fraud its cases may use (catchable with tier tools)
    herrings: tuple[HerringId, ...] = ()
    culture: Culture = field(default_factory=Culture)
    head: dict | None = None  # the boss: a big, honest spender (the CEO herring)
    key_staff: tuple[dict, ...] = ()  # hand-written people; the rest of the roster is generated


def _person(name: str, role: str, department: str, bio: str, look: str) -> dict:
    return {"name": name, "role": role, "department": department, "bio": bio, "look": look}


COMPANIES: dict[str, Company] = {c.id: c for c in [
    # ── Small ──────────────────────────────────────────────────────────────────────
    Company(
        "lakshmi", "Lakshmi Sweets & Caterers", "Dadar, Mumbai", "Family sweet shop and caterer",
        "small",
        "Mrs. Lakshmi Iyer has run the shop since her husband died. Diwali orders keep the "
        "business alive, and this year the cash box doesn't match the order book. She doesn't "
        "trust banks, and she trusts accountants less. Her nephew found your card.",
        "Small daily supplier payments: milk, sugar, ghee. Very regular.",
        "big_invoice", ("big_invoice", "duplicates", "under_limit"),
        key_staff=(
            _person("Venkat Iyer", "Head Cook", "Kitchen",
                    "Forty years at the stove. Knows the price of ghee to the paisa.", "b"),
            _person("Pooja Shetty", "Counter & Accounts", "Finance",
                    "Runs the till, the books and, some say, Mrs. Iyer.", "a"),
            _person("Manoj Gawde", "Delivery Supervisor", "Operations",
                    "Knows every lane in Dadar. Claims every auto ride in it.", "b"),
        ),
    ),
    Company(
        "konkan", "Konkan Coast Travels", "Ratnagiri", "Bus and tour operator", "small",
        "Sameer Patil runs buses between Mumbai and Goa. Fuel bills are up and bookings "
        "aren't. His drivers claim fuel on the road, mostly with handwritten receipts.",
        "Fuel, tolls and repairs. Weekend and night travel are normal here.",
        "duplicates", ("duplicates", "big_invoice", "under_limit"),
        culture=Culture(weekend_share=0.12, night_share=0.05),
        key_staff=(
            _person("Dinesh Sawant", "Senior Driver", "Operations",
                    "Twenty years on the ghats. Never late, never lost, never short of receipts.",
                    "b"),
            _person("Rekha Naik", "Booking Office", "Sales",
                    "Sells every seat twice in her head before she sells it once.", "a"),
            _person("Anil Chavan", "Workshop Foreman", "Maintenance",
                    "Can rebuild an engine blindfolded. Can't find last month's bills.", "b"),
        ),
    ),
    Company(
        "pixel", "Pixel Garage Studios", "Bandra, Mumbai", "Indie game and design studio",
        "small",
        "Two young founders, Zoya Merchant and Neil Fernandes, just got their first investor. "
        "The investor wants a clean audit before the money lands. The founders say everything "
        "is fine. They are very nervous.",
        "Software, hardware and late-night food orders. Late hours are normal here.",
        "under_limit", ("under_limit", "big_invoice", "duplicates"),
        culture=Culture(night_share=0.08),
        key_staff=(
            _person("Neil Fernandes", "Co-founder, Tech", "Technology",
                    "Writes code at 3 AM and expense reports never.", "b"),
            _person("Aisha Khan", "Art Lead", "Design",
                    "Her sketchbook is worth more than the office. She says so often.", "a"),
            _person("Rahul Bhatt", "Office & Finance", "Finance",
                    "The only grown-up in the building. Keeps the receipts in a shoebox.", "b"),
        ),
    ),
    # ── Mid ────────────────────────────────────────────────────────────────────────
    Company(
        "sterling", "Sterling Mercantile Pvt. Ltd.", "Fort, Mumbai", "Old trading house",
        "mid",
        "A hundred-year-old firm that still closes on Saturdays and Sundays. The new MD found "
        "company card charges on days the office was locked.",
        "Strictly Monday to Friday. Everyone gets a big Diwali bonus.",
        "weekend", ("weekend", "duplicates", "big_invoice", "fabricated"),
        herrings=("diwali",), culture=Culture(weekend_share=0.01),
    ),
    Company(
        "bluewave", "Bluewave Pharma Distributors", "Navi Mumbai", "Medicine distributor", "mid",
        "Field reps file hundreds of claims a month. Every claim is the right size and on "
        "time. The CFO says the numbers look \"too tidy\" and can't say why.",
        "Many reps, many small travel and meal claims.",
        "fabricated", ("fabricated", "inflated_ratio", "duplicates"),
    ),
    Company(
        "horizon", "Horizon Realty Developers", "Pune", "Real estate developer", "mid",
        "Bigger projects cost more to sell, and that's fine. But one team's costs have stopped "
        "following their projects.",
        "Expenses grow with deal value. The Chairman spends big on everything.",
        "inflated_ratio", ("inflated_ratio", "big_invoice", "weekend"),
        herrings=("ceo",),
        head={"name": "Rajiv Khanna", "bio": "Chairman. Flies first class to look at plots of "
              "land he could see on Google Maps."},
    ),
    Company(
        "malabar", "Malabar Textiles International", "Kochi", "Textile exporter", "mid",
        "An export house with a famous, flamboyant owner. The board wants an audit before an "
        "IPO, and everyone assumes the problem is the owner.",
        "Huge buyer entertainment bills. The owner's spending is honest, just enormous.",
        "big_invoice", ("big_invoice", "fabricated", "weekend"),
        herrings=("ceo", "diwali"),
        head={"name": "Thomas Kurian", "bio": "Owner. Hosts buyers on his yacht. Pays for the "
              "yacht himself, which nobody believes."},
    ),
    Company(
        "saffron", "Saffron Media Networks", "Andheri, Mumbai", "TV and digital media", "mid",
        "Shoots, events, late nights, weekends. Payments go out at all hours, so nobody "
        "noticed one vendor that only gets paid at night.",
        "Weekend events and night shoots are normal here.",
        "under_limit", ("under_limit", "inflated_ratio", "fabricated", "duplicates"),
        culture=Culture(weekend_share=0.15, night_share=0.06),
    ),
    # ── Large ──────────────────────────────────────────────────────────────────────
    Company(
        "arabian", "Arabian Sea Shipping Co.", "Mumbai Port", "Shipping line", "large",
        "Ships sail every day of the week, so weekend payments are normal. Somewhere in two "
        "and a half thousand payments is a vendor that doesn't exist.",
        "The port never closes: weekend payments are everyday here.",
        "under_limit", ("under_limit", "duplicates", "inflated_ratio", "big_invoice"),
        culture=Culture(weekend_share=0.12),
    ),
    Company(
        "indus", "Indus Steel & Infrastructure", "Nagpur", "Steel and construction", "large",
        "Five departments, five budgets, one board that wants to know why project costs keep "
        "slipping.",
        "Big projects, big bills. The MD's spending is in a league of its own.",
        "inflated_ratio", ("inflated_ratio", "big_invoice", "weekend", "under_limit"),
        herrings=("ceo",),
        head={"name": "Harish Bhandari", "bio": "Managing Director. Signs cheques with a gold "
              "pen he bought with his own money. He has the receipt."},
    ),
    Company(
        "meridian", "Meridian Hospitals Group", "Bengaluru", "Hospital chain", "large",
        "Hospitals never close. Supply claims come in every hour of every day, and one "
        "supplier's numbers feel made up.",
        "Open 24×7: weekend claims are everyday here.",
        "fabricated", ("fabricated", "under_limit", "duplicates", "inflated_ratio"),
        herrings=("diwali",), culture=Culture(weekend_share=0.25),
    ),
    # ── Very large ─────────────────────────────────────────────────────────────────
    Company(
        "vasundhara", "Vasundhara Industries Group", "Mumbai",
        "Conglomerate: chemicals, retail, power", "very_large",
        "Three divisions that barely talk to each other, and a chairman who wants one answer "
        "before the annual meeting.",
        "Three divisions, three habits. The Chairman spends like a small country.",
        "inflated_ratio", ("inflated_ratio", "big_invoice", "duplicates", "fabricated",
                           "under_limit"),
        herrings=("ceo", "diwali"),
        head={"name": "Surendra Bhatia", "bio": "Chairman. Owns three of everything, including "
              "opinions about auditors."},
    ),
    Company(
        "deccan", "Deccan Crown Bank", "Hyderabad", "Private bank", "very_large",
        "A bank audit, where every rupee is someone else's money. Regulators are watching.",
        "Branches open six days a week; the CEO entertains every big client personally.",
        "fabricated", ("fabricated", "duplicates", "weekend", "inflated_ratio", "under_limit"),
        herrings=("ceo",), culture=Culture(weekend_share=0.05),
        head={"name": "Ayesha Raza", "bio": "CEO. Closes deals over dinner at the Taj. Every "
              "dinner is on the books, and every one is real."},
    ),
    # ── The Final ──────────────────────────────────────────────────────────────────
    Company(
        "kaveri", "The Kaveri Inquiry", "New Delhi",
        "National Financial Integrity Commission", "final",
        "The Commission has been watching one name move from company to company for years, "
        "never caught. They've been watching you too. The fraudster has studied every case "
        "you've solved and hides from the tools you rely on most.",
        "A holding group under national inquiry. Everyone here has a lawyer.",
        "under_limit", ("big_invoice", "duplicates", "fabricated", "weekend", "inflated_ratio",
                        "under_limit"),
        herrings=("ceo", "diwali"),
        head={"name": "Devendra Rathore", "bio": "Group CEO of Kaveri Holdings. Has never "
              "personally signed anything. Spends as if he had."},
    ),
]}


def companies_in(tier: Tier) -> list[Company]:
    return [c for c in COMPANIES.values() if c.tier == tier]


@dataclass(frozen=True)
class Cameo:
    """One of the three old colleagues who follow you from your first job (CAREER.md §7.6)."""

    id: str
    name: str
    look: str
    bio: str
    intro: str  # at your first company, where you meet
    reunion: str  # {last} = the last company you worked at together
    confession: str  # caught in the Final
    escape: str  # missed in the Final


CAMEOS: dict[str, Cameo] = {c.id: c for c in [
    Cameo(
        "imran", "Imran Sheikh", "b",
        "Knows everyone's name, birthday and canteen order. Always the first to say hello.",
        "New here? Don't worry, the owner's bark is worse than her bite. I'll show you where "
        "they hide the good biscuits.",
        "Arre, you! Last time was {last}, remember? Small world, this business.",
        "You want to know how? I just said hello. Every company, every year. Nobody ever "
        "checks the friendly one.",
        "Imran waves from the lift. He always waved.",
    ),
    Cameo(
        "tara", "Tara Pinto", "a",
        "Dry wit, sharp pencil. Reads contracts for fun and finds the typos.",
        "You're the auditor? Good. Someone here needs one. I won't say who.",
        "Look who it is. Last time was {last}. You still drink your chai with no sugar?",
        "I followed you because you were good. Good auditors make the books look clean, and "
        "clean books are the best place to hide.",
        "Tara's desk is empty. Her pencil is still there, very sharp.",
    ),
    Cameo(
        "meher", "Meher Contractor", "a",
        "Calm, kind, always has a spare charger. The person everyone asks for help.",
        "First day? Take my charger, you'll need it. These ledgers eat batteries.",
        "You again! Last time was {last}. I told them they should hire you.",
        "You trusted me because I helped you. That's how it works, every time. You were just "
        "the first one who almost noticed.",
        "Meher left her charger on your desk. A thank-you note is taped to it.",
    ),
]}

RESERVED_SURNAMES = {
    "Desai",  # the Chief
    *(c.name.split()[-1] for c in CAMEOS.values()),
    *(p["name"].split()[-1] for c in COMPANIES.values() for p in c.key_staff),
    *(c.head["name"].split()[-1] for c in COMPANIES.values() if c.head),
    "Iyer", "Patil", "Merchant",  # the owners named in the letters
}
