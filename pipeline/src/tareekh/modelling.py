"""Assemble the modelling table (shared by train_within_1y.py and experiments.py so both see
exactly the same rows and inputs)."""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from tareekh.features import add_law, build, decode_acts, section_vocabulary, type_vocabulary
from tareekh.target import within

ROOT = Path(__file__).resolve().parents[2]
CLEAN = ROOT / "data" / "clean" / "10"
KEYS = ROOT / "data" / "raw" / "ddl" / "keys"
TRAIN_YEARS = (2015, 2016)


def key_csv(name: str, keys: Path = KEYS) -> pd.DataFrame:
    return pd.read_csv(keys / name, dtype=str, keep_default_na=False)


def district_names(keys: Path = KEYS) -> dict[str, str]:
    key = key_csv("cases_district_key.csv", keys)
    key = key[key["state_code"] == "10"].sort_values("year")
    return dict(zip(key["dist_code"], key["district_name"], strict=True))


@dataclass
class ModellingData:
    frame: pd.DataFrame        # features + filing_year + within_1y (the horizon label)
    case_types: list[str]
    sections: list[str]


def modelling_data(labelled: pd.DataFrame | None = None, horizon_days: int = 365,
                   clean: Path = CLEAN, keys: Path = KEYS) -> ModellingData:
    """Features for every usable case; `within_1y` holds the label for `horizon_days`
    (the column keeps its name so every script reads the same field).

    Vocabularies (which case types and law sections get their own category) are decided on the
    training years only."""
    if labelled is None:
        labelled = pd.read_parquet(clean / "labelled.parquet")
    # unusable rows (bad dates) are left out of everything, congestion counts included: a case
    # "decided before filing" has no trustworthy end date and would otherwise count as pending
    labelled = labelled[labelled["unusable"] == ""].copy()
    if horizon_days != 365 or "within_1y" not in labelled:
        labelled["within_1y"] = within(labelled, horizon_days)
    train_rows = labelled["filing_year"].isin(TRAIN_YEARS)
    case_types = type_vocabulary(labelled.loc[train_rows, "type"])
    frame = build(labelled, district_names(keys), case_types)
    acts = decode_acts(pd.read_parquet(clean / "acts_sections.parquet"),
                       key_csv("act_key.csv", keys), key_csv("section_key.csv", keys))
    in_train = acts["ddl_case_id"].isin(labelled.loc[train_rows, "ddl_case_id"])
    sections = section_vocabulary(acts.loc[in_train, "law"], acts.loc[in_train, "section"])
    frame = add_law(frame, labelled, acts, sections)
    return ModellingData(frame, case_types, sections)
