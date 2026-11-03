"""Company rosters: twenty fixed people per company, the same in every career (CAREER.md §7.6).

Hand-written key staff come first; the rest are generated from a seed fixed per company, so
Pixel Garage is always Neil, Aisha, Rahul and the same seventeen colleagues."""

import hashlib
from dataclasses import dataclass

import numpy as np

from auditor.career.catalog import CAMEOS, COMPANIES, RESERVED_SURNAMES, ROSTER_SIZE, Company


@dataclass(frozen=True)
class Person:
    key: str  # stable identity across cases ("pixel-07", "cameo-tara")
    name: str
    role: str
    department: str
    bio: str
    portrait: str
    cameo: str | None = None

    @property
    def is_head(self) -> bool:
        return self.role == "CEO"


FIRST_A = ["Aditi", "Bhavna", "Charu", "Deepa", "Esha", "Farah", "Gauri", "Hema", "Ira", "Jaya",
           "Kirti", "Lata", "Mansi", "Neha", "Pallavi", "Rashmi", "Sana", "Swati", "Trisha", "Uma",
           "Vandana", "Yamini", "Nidhi", "Ritu", "Shalini", "Komal", "Anjali", "Priyanka",
           "Madhuri", "Leela"]
FIRST_B = ["Abhay", "Bharat", "Chetan", "Dev", "Eknath", "Gautam", "Harsh", "Irfan", "Jatin",
           "Karan", "Lalit", "Mohit", "Naveen", "Omkar", "Pranav", "Rakesh", "Sanjay", "Tushar",
           "Uday", "Vivek", "Yash", "Zubin", "Ashok", "Girish", "Kunal", "Nitin", "Parag",
           "Ravi", "Sunil", "Vinod"]
SURNAMES = ["Agarwal", "Bhosale", "Chopra", "Dutta", "Gill", "Hegde", "Iyengar", "Jain",
            "Kamath", "Lobo", "Mistry", "Nadkarni", "Ojha", "Pandey", "Rane", "Sethi", "Tiwari",
            "Vaidya", "Wadia", "Yadav", "Zaveri", "Kohli", "Mehra", "Chaudhary", "Deshpande",
            "Gokhale", "Joshi", "Kulkarni", "Malhotra", "Naidu", "Pillai", "Rao", "Sinha",
            "Thakur", "Varma", "Bhatnagar", "D'Souza", "Ghosh", "Kapoor", "Mukherjee"]
assert not RESERVED_SURNAMES & set(SURNAMES), "story surnames must stay out of the generator"

ROLES: list[tuple[str, str]] = [
    ("Accounts Executive", "Finance"), ("Finance Manager", "Finance"),
    ("Sales Executive", "Sales"), ("Key Account Manager", "Sales"),
    ("Procurement Officer", "Operations"), ("Operations Manager", "Operations"),
    ("Logistics Coordinator", "Operations"), ("HR Executive", "People"),
    ("IT Administrator", "Technology"), ("Marketing Executive", "Marketing"),
    ("Admin Officer", "Administration"), ("Legal Associate", "Legal"),
    ("Business Analyst", "Strategy"), ("Customer Relations Lead", "Sales"),
    ("Facilities Supervisor", "Operations"), ("Payroll Officer", "Finance"),
]
HABITS = [
    "Claims every cab, however short the ride.",
    "Always flies, never takes the train. Says the train is slower. It isn't.",
    "Buys chai for the whole floor and files it the same afternoon.",
    "Keeps every receipt in a labelled folder. Every single one.",
    "Takes clients to the same restaurant every time. The waiters know her order.",
    "Never claims anything. Then claims three months at once.",
    "Books the cheapest hotel on purpose and complains about it on purpose.",
    "Orders new equipment the day the old one gets a scratch.",
    "First in, last out. Expenses filed at 8:59 every morning.",
    "Signs off other people's claims faster than he reads them.",
    "Lunches with vendors. Says it's relationship building.",
    "Has a favourite vendor for everything, and a reason for each one.",
    "Rounds every claim to the nearest hundred. Nobody knows why.",
    "Travels more than anyone in the department. Mostly to the same city.",
    "Answers email at midnight. Files claims at midnight too.",
    "Quiet, careful, and owns the only working stapler.",
    "Knows the expense policy by heart and quotes it at parties.",
    "Has never once lost a receipt. Has lost several umbrellas.",
]


def _seed(*parts: str) -> int:
    return int.from_bytes(hashlib.sha256("|".join(parts).encode()).digest()[:8], "big")


def roster(company: Company) -> list[Person]:
    """The company's twenty people (plus its head, if it has one) — fixed forever."""
    rng = np.random.default_rng(_seed("roster", company.id))
    people = [
        Person(f"{company.id}-{i:02d}", p["name"], p["role"], p["department"], p["bio"],
               f"{p['look']}-{company.id}-{i:02d}")
        for i, p in enumerate(company.key_staff)
    ]
    used = {p.name for p in people}
    while len(people) < ROSTER_SIZE:
        look = "a" if rng.random() < 0.5 else "b"
        name = f"{rng.choice(FIRST_A if look == 'a' else FIRST_B)} {rng.choice(SURNAMES)}"
        if name in used:
            continue
        used.add(name)
        role, department = ROLES[int(rng.integers(len(ROLES)))]
        i = len(people)
        people.append(Person(f"{company.id}-{i:02d}", name, role, department,
                             str(rng.choice(HABITS)), f"{look}-{company.id}-{i:02d}"))
    if company.head:
        people.append(Person(f"{company.id}-head", company.head["name"], "CEO", "Leadership",
                             company.head["bio"], f"b-{company.id}-head"))
    return people


def cameo_person(cameo_id: str, company: Company) -> Person:
    """An old colleague, in whatever job they hold at this company."""
    cameo = CAMEOS[cameo_id]
    rng = np.random.default_rng(_seed("cameo-role", cameo_id, company.id))
    role, department = ROLES[int(rng.integers(len(ROLES)))]
    return Person(f"cameo-{cameo_id}", cameo.name, role, department, cameo.bio,
                  f"{cameo.look}-cameo-{cameo_id}", cameo=cameo_id)


def company_people(company_id: str, cameo_ids: list[str]) -> list[Person]:
    company = COMPANIES[company_id]
    return roster(company) + [cameo_person(c, company) for c in cameo_ids]
