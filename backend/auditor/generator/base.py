"""Honest company life: suspects and the everyday expense ledger they produce.

Amounts are log-normal within each expense category. Because the categories span
about three orders of magnitude (₹100 chai to ₹31,600 laptops), the mixture of all
claims follows Benford's law, just like real-world financial data.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from auditor.models import Suspect

SUSPECT_POOL: list[dict] = [
    {"name": "Priya Nair", "role": "Senior Accountant", "department": "Finance",
     "bio": "Never misses a deadline. Never takes a holiday. Never lets anyone else touch her ledgers."},
    {"name": "Arjun Mehta", "role": "Sales Manager", "department": "Sales",
     "bio": "Closes deals over dinner. Lots of dinners. Remembers every client's favourite whisky."},
    {"name": "Meera Iyer", "role": "Procurement Lead", "department": "Operations",
     "bio": "Knows every vendor in Mumbai by first name — and a few by nickname."},
    {"name": "Kabir Shah", "role": "IT Manager", "department": "Technology",
     "bio": "Buys a new laptop every quarter 'for testing'. The old ones are never seen again."},
    {"name": "Ananya Rao", "role": "HR Business Partner", "department": "People",
     "bio": "Organises every offsite. Somehow the venue is always her cousin's resort."},
    {"name": "Rohan Desai", "role": "Regional Director", "department": "Sales",
     "bio": "Flies business class to meetings that could have been emails."},
    {"name": "Sneha Kulkarni", "role": "Finance Controller", "department": "Finance",
     "bio": "Signs off on everything. Reads almost nothing. Smiles a lot."},
    {"name": "Farhan Qureshi", "role": "Logistics Head", "department": "Operations",
     "bio": "Runs the warehouse like a ship. Nobody has ever seen the captain's log."},
    {"name": "Divya Menon", "role": "Marketing Manager", "department": "Marketing",
     "bio": "Her campaigns go viral. So do her expense reports, around the office."},
    {"name": "Siddharth Joshi", "role": "Product Lead", "department": "Technology",
     "bio": "Ships features on Friday night and expenses on Monday morning."},
    {"name": "Kavya Pillai", "role": "Legal Counsel", "department": "Legal",
     "bio": "Reads the fine print for a living. Writes some of her own, too."},
    {"name": "Nikhil Bose", "role": "Facilities Manager", "department": "Operations",
     "bio": "Fixes the AC, the lifts and, allegedly, the numbers."},
    {"name": "Ishita Malhotra", "role": "Key Account Manager", "department": "Sales",
     "bio": "Her biggest client loves five-star hotels. Or so the receipts say."},
    {"name": "Varun Reddy", "role": "Data Analyst", "department": "Finance",
     "bio": "Knows exactly how the audit tools work. That's either reassuring or terrifying."},
    {"name": "Tanvi Gupta", "role": "Events Coordinator", "department": "Marketing",
     "bio": "Every party is unforgettable. The invoices are surprisingly forgettable."},
    {"name": "Aditya Banerjee", "role": "Operations Analyst", "department": "Operations",
     "bio": "Quiet, punctual, works weekends. Nobody asks why."},
]
# Portrait keys tell the frontend's procedural portraits which look family to draw:
# "a" = long hair / saree / kurta looks, "b" = short hair / tie / beard looks.
_LOOK = {"Priya": "a", "Meera": "a", "Ananya": "a", "Sneha": "a", "Divya": "a", "Kavya": "a",
         "Ishita": "a", "Tanvi": "a"}
for i, s in enumerate(SUSPECT_POOL, start=1):
    s["portrait"] = f"{_LOOK.get(s['name'].split()[0], 'b')}{i:02d}"

CEO: dict = {
    "name": "Vikram Kapoor", "role": "CEO", "department": "Leadership", "portrait": "b00",
    "bio": "Built the firm from a Dadar garage. Spends like a man who owns the building — because he does.",
}

# category -> (median INR, weight). Medians sit 1/6 of a decade apart in log10 so the
# mixture has near-uniform mantissas (= Benford). Spread of each category is HONEST_SIGMA.
CATEGORY_PROFILES: dict[str, tuple[float, float]] = {
    "chai_snacks": (100.0, 0.18),
    "cab": (460.0, 0.18),
    "client_meal": (2150.0, 0.17),
    "hotel": (6800.0, 0.16),
    "flight": (14700.0, 0.16),
    "equipment": (31600.0, 0.15),
}
HONEST_SIGMA = 0.40  # sigma of ln(amount) within a category
HONEST_Z_CLIP = 2.5  # expense policy: honest claims never stray past 2.5 sigma
CEO_MULTIPLIER = 4.0
MARGIN_MEDIAN = 0.05  # expense / revenue of the deal it served
MARGIN_SIGMA = 0.30
WEEKEND_SHARE = 0.02
CASE_DAYS = 90

VENDORS: dict[str, list[str]] = {
    "chai_snacks": ["Kayani Irani Café", "Tapri Corner", "Dadar Snack House", "Bandra Chai Co."],
    "cab": ["Kaali-Peeli Taxi Co.", "CityGlide Cabs", "Sea Link Rides", "Metro Auto Union"],
    "client_meal": ["Colaba Brasserie", "Malabar Spice House", "Konkan Coast Kitchen",
                    "The Bombay Canteen Club", "Worli Grill"],
    "hotel": ["Marine Crest Hotel", "Juhu Palms Residency", "Gateway Heritage Inn",
              "Powai Lakeside Suites"],
    "flight": ["SkyWing Airways", "Deccan Air", "Monsoon Airlines"],
    "equipment": ["Lamington Road Electronics", "DataVault Systems", "Nariman Office Supplies",
                  "Andheri Tech Traders"],
}
FESTIVAL_VENDOR = "Payroll — Festival Bonus"
COLUMNS = ["txn_id", "date", "hour", "employee_id", "vendor", "category", "amount", "revenue",
           "invoice_id"]


def make_suspects(rng: np.random.Generator, include_ceo: bool, n: int = 5) -> list[Suspect]:
    picks = rng.choice(len(SUSPECT_POOL), size=n - int(include_ceo), replace=False)
    people = [SUSPECT_POOL[i] for i in picks]
    if include_ceo:
        people.insert(int(rng.integers(0, n)), CEO)
    return [Suspect(id=f"E{i}", **p) for i, p in enumerate(people, start=1)]


def business_days(start: date, days: int = CASE_DAYS) -> tuple[list[date], list[date]]:
    all_days = [start + timedelta(days=d) for d in range(days)]
    return [d for d in all_days if d.weekday() < 5], [d for d in all_days if d.weekday() >= 5]


def honest_amounts(rng: np.random.Generator, categories: np.ndarray) -> np.ndarray:
    medians = np.array([CATEGORY_PROFILES[c][0] for c in categories])
    z = np.clip(rng.normal(size=len(categories)), -HONEST_Z_CLIP, HONEST_Z_CLIP)
    return medians * np.exp(HONEST_SIGMA * z)


def make_honest_transactions(
    rng: np.random.Generator,
    suspects: list[Suspect],
    n_rows: int = 1000,
    start: date = date(2026, 7, 1),
) -> pd.DataFrame:
    cats = list(CATEGORY_PROFILES)
    weights = np.array([CATEGORY_PROFILES[c][1] for c in cats])
    weights = weights / weights.sum()

    # Each employee has two favourite vendors per category (habits make data realistic).
    favourites = {
        s.id: {c: list(rng.choice(VENDORS[c], size=2, replace=False)) for c in cats}
        for s in suspects
    }

    employees = rng.choice([s.id for s in suspects], size=n_rows)
    categories = rng.choice(cats, size=n_rows, p=weights)
    amounts = honest_amounts(rng, categories)
    ceo_ids = {s.id for s in suspects if s.role == "CEO"}
    amounts = np.where(np.isin(employees, list(ceo_ids)), amounts * CEO_MULTIPLIER, amounts)

    vendors = [
        rng.choice(favourites[e][c]) if rng.random() < 0.75 else rng.choice(VENDORS[c])
        for e, c in zip(employees, categories)
    ]

    weekdays, weekends = business_days(start)
    on_weekend = rng.random(n_rows) < WEEKEND_SHARE
    dates = [
        weekends[rng.integers(len(weekends))] if w else weekdays[rng.integers(len(weekdays))]
        for w in on_weekend
    ]
    hours = np.clip(np.rint(rng.normal(14, 2.5, n_rows)), 9, 20).astype(int)
    margins = np.exp(rng.normal(np.log(MARGIN_MEDIAN), MARGIN_SIGMA, n_rows))
    amounts = np.round(amounts, 2)

    df = pd.DataFrame({
        "txn_id": [f"T{i:05d}" for i in range(1, n_rows + 1)],
        "date": dates,
        "hour": hours,
        "employee_id": employees,
        "vendor": vendors,
        "category": categories,
        "amount": amounts,
        "revenue": np.round(amounts / margins, 2),
        "invoice_id": [f"INV-{n}" for n in rng.choice(np.arange(100000, 1000000), n_rows,
                                                       replace=False)],
    })
    return df[COLUMNS]


def next_ids(df: pd.DataFrame, rng: np.random.Generator, n: int) -> tuple[list[str], list[str]]:
    """Fresh txn and invoice ids for rows a scheme adds."""
    start = int(df["txn_id"].str[1:].astype(int).max()) + 1
    txn = [f"T{i:05d}" for i in range(start, start + n)]
    used = set(df["invoice_id"])
    invoices: list[str] = []
    while len(invoices) < n:
        cand = f"INV-{int(rng.integers(100000, 1000000))}"
        if cand not in used:
            used.add(cand)
            invoices.append(cand)
    return txn, invoices
