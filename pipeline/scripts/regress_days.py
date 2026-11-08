"""Linear regression: how many days does a case take, among cases that finish within two years?

The main model answers a yes/no question because many cases never finish inside the data. A
regression on days needs a finished case, so this asks a narrower question and says so:
"among cases disposed of within 730 days of filing, how many days did they take?"

Train on 2015 filings, test on 2016 filings. Every 2015-2016 filing was watched for at least
730 days (cutoffs are 31 Dec 2018 or later), so both years are measured over the same window.
The target is log(1 + days) because durations are heavily skewed. The baseline is the median
days for that case type in the training year.

    uv run python scripts/regress_days.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, median_absolute_error, r2_score
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from train_within_1y import one_hot

from tareekh.features import FEATURE_SETS
from tareekh.modelling import CLEAN, modelling_data

HORIZON = 730
CATS, NUMS = FEATURE_SETS["+ law and section"]
COLS = CATS + NUMS


def report(days: np.ndarray, predicted: np.ndarray) -> dict:
    return {"n": len(days), "mae_days": float(mean_absolute_error(days, predicted)),
            "median_error_days": float(median_absolute_error(days, predicted)),
            "r2_log_days": float(r2_score(np.log1p(days), np.log1p(np.clip(predicted, 0, None))))}


def main() -> int:
    labelled = pd.read_parquet(CLEAN / "labelled.parquet")
    frame = modelling_data(labelled).frame.join(labelled[["observed_days", "ended"]])
    finished = frame[frame["ended"] & (frame["observed_days"] <= HORIZON)]
    train, test = finished[finished.filing_year == 2015], finished[finished.filing_year == 2016]
    model = Pipeline([("prep", one_hot(CATS, NUMS)), ("model", LinearRegression())])
    model.fit(train[COLS], np.log1p(train["observed_days"]))
    predicted = np.expm1(model.predict(test[COLS]))
    baseline = test["case_type"].map(train.groupby("case_type")["observed_days"].median()).fillna(
        train["observed_days"].median()).to_numpy()
    days = test["observed_days"].to_numpy()
    result = {"question": f"Days to disposal, among cases disposed of within {HORIZON} days",
              "train_filing_year": 2015, "test_filing_year": 2016, "train_cases": len(train),
              "linear_regression": report(days, predicted),
              "baseline_median_per_case_type": report(days, baseline)}
    (ROOT / "reports" / "days_regression.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
