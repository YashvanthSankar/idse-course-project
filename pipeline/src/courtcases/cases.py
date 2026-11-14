"""Load DDL's yearly case files and turn the raw columns into clean, typed ones.

What the raw files look like (measured on cases_2010.csv, 4,281,327 rows):
- one row per case; codes (state, district, court) are zero-padded strings ("01"), so they
  must be read as text or "01" and "1" stop matching the keys;
- case type, purpose and disposition are numeric codes whose meaning is in per-year key files;
- gender columns are text with sentinel values: "0 male", "1 female", "-9998 unclear",
  "-9999 missing name"; advocate gender uses bare 0 / 1 / -9998 / -9999;
- dates are ISO strings but include impossible values (year 0001, 5000-01-01, 9201-…),
  and some decisions are dated before the filing.

Nothing here decides what a "pending" case is: that needs the scrape cutoff (`cutoff.py`).
"""

from pathlib import Path

import pandas as pd

DATE_COLUMNS = ["date_of_filing", "date_of_decision", "date_first_list", "date_last_list",
                "date_next_list"]
# The eCourts system went live from 2007; anything before 1950 or after 2022 is a typo
EARLIEST, LATEST = pd.Timestamp("1950-01-01"), pd.Timestamp("2022-12-31")

GENDER = {"0 male": "male", "1 female": "female", "-9998 unclear": "unclear",
          "-9999 missing name": "missing"}
ADVOCATE_GENDER = {"0": "male", "1": "female", "-9998": "unclear", "-9999": "missing"}

KEY_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "ddl" / "keys"


def read_raw(path: Path, states: list[str] | None = None, columns: list[str] | None = None
             ) -> pd.DataFrame:
    """Every column as text, exactly as stored, optionally only some states (by code)."""
    df = pd.read_csv(path, dtype=str, keep_default_na=False, engine="pyarrow",
                     usecols=columns)
    if states is not None:
        df = df[df["state_code"].isin(states)].reset_index(drop=True)
    return df


def _year_key(name: str, code_col: str, label_col: str, key_dir: Path) -> pd.DataFrame:
    key = pd.read_csv(key_dir / name, dtype=str, keep_default_na=False)
    return key[["year", code_col, label_col]].rename(columns={code_col: "code",
                                                              label_col: "label"})


def decode(df: pd.DataFrame, key_dir: Path = KEY_DIR) -> pd.DataFrame:
    """Replace codes with their labels (per filing year, since codes are numbered per year),
    gender sentinels with categories, and date strings with checked timestamps."""
    out = df.copy()
    for col, name, label in [("type_name", "type_name_key.csv", "type_name_s"),
                             ("purpose_name", "purpose_name_key.csv", "purpose_name_s"),
                             ("disp_name", "disp_name_key.csv", "disp_name_s")]:
        if col not in out:
            continue
        key = _year_key(name, col, label, key_dir)
        merged = out[["year", col]].merge(key, how="left", left_on=["year", col],
                                          right_on=["year", "code"])
        out[col.removesuffix("_name")] = merged["label"].fillna("").to_numpy()
    for col in ("female_defendant", "female_petitioner"):
        if col in out:
            out[col.removeprefix("female_")] = out[col].map(GENDER).fillna("missing")
    for col in ("female_adv_def", "female_adv_pet"):
        if col in out:
            out[col.replace("female_", "")] = out[col].map(ADVOCATE_GENDER).fillna("missing")
    for col in DATE_COLUMNS:
        if col in out:
            parsed = pd.to_datetime(out[col], errors="coerce", format="%Y-%m-%d")
            impossible = parsed.notna() & ((parsed < EARLIEST) | (parsed > LATEST))
            out[f"{col}_impossible"] = impossible
            out[col] = parsed.mask(impossible)
    if {"date_of_filing", "date_of_decision"} <= set(out):
        days = (out["date_of_decision"] - out["date_of_filing"]).dt.days
        out["decided_before_filing"] = days < 0
        out["days_to_decision"] = days.where(days >= 0)
    return out


def load(path: Path, states: list[str] | None = None, key_dir: Path = KEY_DIR) -> pd.DataFrame:
    return decode(read_raw(path, states), key_dir)
