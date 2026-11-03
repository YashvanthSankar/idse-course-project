"""Estimate each district's scrape cutoff and label every case of a state.

Reads data/clean/<state>/cases_*.parquet (from build_dataset.py) and writes:
- data/clean/<state>/cutoffs.parquet : one cutoff per district (state fallback applied)
- data/clean/<state>/labelled.parquet: decoded cases + group, observed_days, ended, unusable,
  cutoff, filing_year, within_1y

Cutoffs use decisions from *all* filing years together and the stricter "last month with at
least half a normal month of decisions" rule (share=0.5), because the scrape ran during
February 2019 and a partly scraped month would make decided cases look pending.

    uv run python scripts/label_cases.py --state 10
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from tareekh.cases import decode
from tareekh.cutoff import cutoffs, with_fallback
from tareekh.target import label, within

CLEAN = ROOT / "data" / "clean"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--state", default="10")
    parser.add_argument("--share", type=float, default=0.5)
    parser.add_argument("--clean", type=Path, default=CLEAN)
    args = parser.parse_args(argv)

    folder = args.clean / args.state
    files = sorted(folder.glob("cases_*.parquet"))
    if not files:
        parser.error(f"no {folder}/cases_*.parquet: run build_dataset.py first")
    cases = decode(pd.concat([pd.read_parquet(f) for f in files], ignore_index=True))

    state = cutoffs(cases, by="state_code", share=args.share)
    district = cutoffs(cases, by=["state_code", "dist_code"], share=args.share)
    district = with_fallback(district, state, parent_of=lambda key: key[0])
    per_case = pd.Series([district.get(k) for k in zip(cases["state_code"], cases["dist_code"],
                                                       strict=True)], index=cases.index)
    labelled = label(cases, per_case)
    labelled["filing_year"] = labelled["date_of_filing"].dt.year
    labelled["within_1y"] = within(labelled, 365)

    district.rename("cutoff").reset_index().to_parquet(folder / "cutoffs.parquet")
    labelled.to_parquet(folder / "labelled.parquet")
    print(f"{len(labelled):,} cases; cutoffs {district.value_counts().sort_index().to_dict()}")
    print("unusable:", labelled["unusable"].value_counts().to_dict())
    print(labelled.groupby("filing_year")["within_1y"].agg(["count", "mean"]).round(3)
          .to_string())
    return 0


if __name__ == "__main__":
    sys.exit(main())
