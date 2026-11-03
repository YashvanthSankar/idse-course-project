"""Calibrate the career bars (CAREER.md §10): bots play whole contracts at every tier.

Three bots, none of which sees the answers:
  sharp    follows the briefing; on vague cases tries the tools for the company's usual tricks
           until one singles someone out; pins rows the way a careful player would
  runall   runs every tool the budget allows, accuses whoever is named most
  guesser  runs nothing, accuses at random

Target: a sharp detective reaches Exceptional ~80% of the time at Small/Mid, ~30-40% at Large
and above.

Usage: uv run python scripts/calibrate_career.py --contracts 40
"""

import argparse
import time
from collections import Counter

import numpy as np
import pandas as pd

from auditor.career.cases import (
    CLEAR,
    HINT,
    INTENDED,
    build_career_case,
    intended_cost,
    plan_contract,
)
from auditor.career.catalog import COMPANIES, TIER_SPECS
from auditor.career.people import company_people
from auditor.career.proof import fits, singles_out
from auditor.career.rating import EXHIBITS_NEEDED, Charge, contract_band, rate_case
from auditor.generator.schemes import APPROVAL_LIMIT
from auditor.models import SchemeId, ToolId, ToolResult
from auditor.results import tool_result
from auditor.tools.registry import TOOLS

TIERS = ["small", "mid", "large", "very_large"]  # the Final has no bands to calibrate
BOTS = ["sharp", "runall", "guesser"]
TRAVEL = ["client_meal", "hotel", "flight", "cab"]


def tool_for(scheme: SchemeId, unlocked: list[ToolId]) -> tuple[ToolId, dict]:
    tool = next(t for t in INTENDED[scheme] if t in unlocked)
    return tool, {"by": "vendor"} if tool == "groupby" else {}


def briefed_scheme(briefing: str) -> SchemeId | None:
    """What an easy or medium briefing points at: each hint belongs to one trick."""
    return next((s for s, text in [*CLEAR.items(), *HINT.items()] if text in briefing), None)


def exhibits(df: pd.DataFrame, suspect: str, theory: SchemeId, clues: list[ToolResult]) -> list[str]:
    """Rows from the accused's ledger that show the trick, chosen without knowing the answer."""
    mine = df[df["employee_id"] == suspect]
    if theory == "big_invoice":
        listed = [r["txn_id"] for c in clues for r in (c.table or [])
                  if r.get("employee_id") == suspect and "txn_id" in r]
        picks = listed or mine.nlargest(1, "amount")["txn_id"].tolist()
    elif theory == "duplicates":
        twins = mine[mine.duplicated(["vendor", "amount"], keep="first")]
        picks = twins.sort_values("date")["txn_id"].tolist()
    elif theory == "weekend":
        days = pd.to_datetime(mine["date"]).dt.weekday
        picks = mine[days >= 5].nlargest(EXHIBITS_NEEDED, "amount")["txn_id"].tolist()
    elif theory == "inflated_ratio":
        travel = mine[mine["category"].isin(TRAVEL)]
        picks = travel.assign(r=travel["amount"] / travel["revenue"]).nlargest(
            EXHIBITS_NEEDED, "r")["txn_id"].tolist()
    elif theory == "under_limit":
        others = set(df.loc[df["employee_id"] != suspect, "vendor"])
        odd = mine[~mine["vendor"].isin(others) & mine["amount"].between(40_000, APPROVAL_LIMIT)]
        picks = odd["txn_id"].tolist()
    else:  # fabricated: every claim of theirs is made up
        picks = mine.nlargest(EXHIBITS_NEEDED, "amount")["txn_id"].tolist()
    return picks[:EXHIBITS_NEEDED] or mine.nlargest(1, "amount")["txn_id"].tolist()


class Desk:
    """One case as a bot plays it: tools cost coins, results pile up."""

    def __init__(self, bundle):
        self.bundle, self.df = bundle, bundle.df
        self.left = bundle.meta.budget
        self.names = {s.id: s.name for s in bundle.meta.suspects}
        self.results: list[ToolResult] = []

    def run(self, tool: ToolId, params: dict) -> ToolResult | None:
        cost = TOOLS[tool].cost
        if cost > self.left:
            return None
        self.left -= cost
        result = tool_result(tool, self.df, params, self.names, cost, self.left)
        self.results.append(result)
        return result

    @property
    def spent(self) -> int:
        return self.bundle.meta.budget - self.left


def sharp(desk: Desk, company, culprits: int, rng) -> list[Charge]:
    unlocked = desk.bundle.meta.unlocked_tools
    hinted = briefed_scheme(desk.bundle.meta.briefing)
    # A vague case with one fraudster is never the company's usual trick (CAREER.md §2.1)
    usual = company.signature if culprits == 1 and len(company.schemes) > 1 else None
    tries = [hinted] if hinted else [s for s in company.schemes if s != usual]
    tries = sorted(tries, key=lambda s: TOOLS[tool_for(s, unlocked)[0]].cost)
    found: dict[str, tuple[SchemeId, ToolResult]] = {}
    for scheme in tries:
        result = desk.run(*tool_for(scheme, unlocked))
        if result is None:
            continue
        for suspect in result.implicates:
            if singles_out(result, suspect) and fits(result, scheme) and suspect not in found:
                found[suspect] = (scheme, result)
        if len(found) >= culprits:
            break
    charges = [Charge(suspect=s, theory=t, clues=[r], exhibits=exhibits(desk.df, s, t, [r]))
               for s, (t, r) in list(found.items())[:culprits]]
    return charges + guesses(desk, culprits - len(charges), rng, {c.suspect for c in charges})


def runall(desk: Desk, company, culprits: int, rng) -> list[Charge]:
    unlocked = desk.bundle.meta.unlocked_tools
    for tool in sorted((t for t in unlocked if t != "summary"), key=lambda t: TOOLS[t].cost):
        desk.run(tool, {"by": "vendor"} if tool == "groupby" else {})
    named = Counter(s for r in desk.results for s in r.implicates)
    charges = []
    for suspect, _ in named.most_common(culprits):
        clues = [r for r in desk.results if suspect in r.implicates][:2]
        theory = next((s for r in clues for s in company.schemes if fits(r, s)), company.signature)
        charges.append(Charge(suspect=suspect, theory=theory, clues=clues,
                              exhibits=exhibits(desk.df, suspect, theory, clues)))
    return charges + guesses(desk, culprits - len(charges), rng, {c.suspect for c in charges})


def guesser(desk: Desk, company, culprits: int, rng) -> list[Charge]:
    return guesses(desk, culprits, rng, set())


def guesses(desk: Desk, n: int, rng, taken: set[str]) -> list[Charge]:
    pool = [s.id for s in desk.bundle.meta.suspects if s.id not in taken]
    picks = rng.choice(pool, size=n, replace=False) if n > 0 else []
    schemes = list(INTENDED)
    out = []
    for suspect in picks:
        theory = schemes[int(rng.integers(len(schemes)))]
        out.append(Charge(suspect=str(suspect), theory=theory, clues=[],
                          exhibits=exhibits(desk.df, str(suspect), theory, [])))
    return out


PLAYERS = {"sharp": sharp, "runall": runall, "guesser": guesser}


def play_contract(company, seed: int) -> dict[str, tuple[list[float], list[bool], str, bool]]:
    rng = np.random.default_rng(seed)
    plans = plan_contract(company, rng)
    people = company_people(company.id, [])
    spec = TIER_SPECS[company.tier]
    out: dict[str, tuple[list[float], list[bool], str, bool]] = {}
    played = {b: ([], [], []) for b in BOTS}  # ratings, correct, difficulty
    for plan in plans:
        bundle, _ = build_career_case(plan, people, "CAL", f"cal{seed}", len(plans))
        culprits = bundle.truth.culprits()
        cost = intended_cost([c.scheme for c in culprits], bundle.meta.unlocked_tools)
        for bot in BOTS:
            desk = Desk(bundle)
            charges = PLAYERS[bot](desk, company, len(culprits), rng)
            rating = rate_case(culprits, charges, desk.spent, cost, spec.slack)
            ratings, correct, kinds = played[bot]
            ratings.append(rating.total)
            correct.append(rating.caught == rating.culprits)
            kinds.append(plan.difficulty)
    for bot, (ratings, correct, kinds) in played.items():
        hard = [ok for ok, k in zip(correct, kinds) if k in ("hard", "very_hard")]
        band = contract_band(ratings, all(correct), all(hard), spec.exceptional)
        out[bot] = (ratings, correct, band, all(hard))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contracts", type=int, default=40, help="contracts per tier")
    parser.add_argument("--tiers", nargs="*", default=TIERS)
    args = parser.parse_args()

    for tier in args.tiers:
        started = time.time()
        companies = [c for c in COMPANIES.values() if c.tier == tier]
        bands = {b: Counter() for b in BOTS}
        averages = {b: [] for b in BOTS}
        solved = {b: [] for b in BOTS}
        sharp_runs: list[tuple[float, bool]] = []  # (average, hard case solved): to try other bars
        for i in range(args.contracts):
            company = companies[i % len(companies)]
            for bot, (ratings, correct, band, hard) in play_contract(company, 1000 + i).items():
                if bot == "sharp":
                    sharp_runs.append((sum(ratings) / len(ratings), hard))
                bands[bot][band] += 1
                averages[bot].append(sum(ratings) / len(ratings))
                solved[bot] += correct
        spec = TIER_SPECS[tier]
        print(f"\n{tier.upper()}  (Exceptional bar {spec.exceptional}, slack {spec.slack}, "
              f"{args.contracts} contracts, {time.time() - started:.0f}s)")
        for bot in BOTS:
            n = args.contracts
            share = {b: f"{100 * bands[bot][b] / n:3.0f}%" for b in
                     ("exceptional", "good", "ok", "bad")}
            avg = np.array(averages[bot])
            print(f"  {bot:8} avg {avg.mean():5.1f} (p25 {np.percentile(avg, 25):5.1f}, "
                  f"p75 {np.percentile(avg, 75):5.1f})  solved {100 * np.mean(solved[bot]):3.0f}%  "
                  + "  ".join(f"{k} {v}" for k, v in share.items()), flush=True)
        print("  sharp Exceptional at other bars: " + "  ".join(
            f"{bar}: {100 * np.mean([a >= bar and h for a, h in sharp_runs]):.0f}%"
            for bar in range(80, 97, 2)))


if __name__ == "__main__":
    main()
