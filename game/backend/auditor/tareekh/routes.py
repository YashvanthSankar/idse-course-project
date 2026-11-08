"""/api/model: "will a Tamil Nadu district-court case be disposed of within a year?".

A visitor picks a district, a kind of case (a common real combination of case type, court
level, law and section, exported by the pipeline) and the month of filing. The model also needs
things a visitor can't know: how congested that district's courts of that level were, and how
many similar cases the district had the year before. Those are looked up as they stood at the
end of the data (early 2019) and the response says so.

Explanations: for logistic regression the log-odds are a sum of one contribution per input, so
each input's effect is its contribution minus the average contribution over 2017 cases.
"""

import json
import random
from collections.abc import Callable
from functools import cache
from pathlib import Path
from statistics import median

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

DATA = Path(__file__).resolve().parent / "data"
NOTICE = ("A historical estimate from Tamil Nadu district-court records (cases filed 2015-2017, "
          "scraped early 2019). Not a prediction for any real case, and not legal advice.")
CREDIT = "Contains data from Development Data Lab's judicial data, ODbL v1.0."


@cache
def _json(name: str):
    return json.loads((DATA / f"{name}.json").read_text())


@cache
def _model():
    return joblib.load(DATA / "model.joblib")


@cache
def _lookups() -> dict:
    inputs = _json("inputs")
    congestion = {(c["district"], c["court_level"]): c for c in inputs["congestion"]}
    filings = {(f["district"], f["case_type"]): f["log_prev_year_filings"]
               for f in inputs["prev_year_filings"]}
    return {
        "kinds": {k["id"]: k for k in inputs["kinds"]},
        "congestion": congestion, "filings": filings,
        "median_congestion": {
            key: median(c[key] for c in inputs["congestion"])
            for key in ("log_pending_at_filing", "clearance_last_year")},
        "median_filings": median(filings.values()),
    }


def _slices(model) -> dict[str, slice]:
    prep = model.named_steps["prep"]
    cats, nums = _json("inputs")["categorical"], _json("inputs")["numeric"]
    encoder = prep.named_transformers_["cat"]
    out, start = {}, 0
    for col, categories in zip(cats, encoder.categories_, strict=True):
        out[col] = slice(start, start + len(categories))
        start += len(categories)
    for col in nums:
        out[col] = slice(start, start + 1)
        start += 1
    return out


def predict_row(row: dict) -> tuple[float, list[dict]]:
    """Probability and the per-input effects (log-odds vs an average 2017 case)."""
    inputs = _json("inputs")
    model = _model()
    cols = inputs["categorical"] + inputs["numeric"]
    frame = pd.DataFrame([{c: row[c] for c in cols}])
    probability = float(model.predict_proba(frame)[0, 1])
    x = model.named_steps["prep"].transform(frame)
    x = x.toarray() if hasattr(x, "toarray") else np.asarray(x)
    weighted = x[0] * model.named_steps["model"].coef_[0]
    effects = []
    for col, s in _slices(model).items():
        effect = float(weighted[s].sum()) - inputs["mean_contribution"][col]
        effects.append({"input": col, "label": inputs["labels"].get(col, col),
                        "value": row[col] if col in inputs["categorical"] else None,
                        "effect": effect})
    effects.sort(key=lambda e: -abs(e["effect"]))
    return probability, effects


# The site calls this API through Vercel, so a whole class arrives from a few proxy addresses:
# the limit is per proxy, not per student. A prediction takes milliseconds.
MODEL_PER_MINUTE = 3000

KIND_FIELDS = ("id", "title", "law_detail", "case_type_name", "court_level", "cases_2017",
               "within_1y_2017", "topic", "variant", "timing")


class PredictIn(BaseModel):
    district: str = Field(max_length=60)
    kind: str = Field(max_length=10)
    filing_month: int = Field(ge=1, le=12)


def build_row(body: PredictIn) -> tuple[dict, dict]:
    look = _lookups()
    inputs = _json("inputs")
    if body.district not in inputs["districts"]:
        raise HTTPException(404, "Unknown district")
    kind = look["kinds"].get(body.kind)
    if kind is None:
        raise HTTPException(404, "Unknown kind of case")
    court = look["congestion"].get((body.district, kind["court_level"]))
    filings = look["filings"].get((body.district, kind["case_type"]))
    row = {
        "district": body.district, "filing_month": str(body.filing_month),
        **{c: kind[c] for c in ("court_level", "case_type", "law", "law_section",
                                "ipc_bailable", "criminal", "n_ipc_sections")},
        "log_pending_at_filing": (court or look["median_congestion"])["log_pending_at_filing"],
        "clearance_last_year": (court or look["median_congestion"])["clearance_last_year"],
        "log_prev_year_filings": filings if filings is not None else look["median_filings"],
    }
    context = {
        "court_found": court is not None,
        "court": None if court is None else {k: court[k] for k in (
            "pending", "disposed_last_year", "cutoff")},
        "similar_filings_found": filings is not None,
    }
    return row, context


MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]


def used_inputs(row: dict, kind: dict, context: dict) -> list[dict]:
    """Every value the model received, readable, and where it came from: the visitor's choice,
    implied by the kind of case they picked, or looked up from the court data."""
    court = context["court"]
    def fmt(n: float) -> str:
        return f"{round(n):,}"
    section = row["law_section"].split(" s.", 1)[1] if " s." in row["law_section"] else "other"
    bailable = row["ipc_bailable"]
    out = [
        ("district", row["district"], "you"),
        ("filing_month", MONTHS[int(row["filing_month"]) - 1], "you"),
        ("case_type", kind["case_type_name"], "case"),
        ("court_level", row["court_level"], "case"),
        ("law", row["law"], "case"),
        ("law_section", section, "case"),
        ("criminal", row["criminal"], "case"),
        ("ipc_bailable", bailable, "case"),
        ("n_ipc_sections", fmt(row["n_ipc_sections"]), "case"),
        ("log_pending_at_filing",
         f"{court['pending']:,} cases" if court else "Tamil Nadu typical value", "data"),
        ("clearance_last_year",
         f"{court['disposed_last_year']:,} cases closed in a year" if court
         else "Tamil Nadu typical value", "data"),
        ("log_prev_year_filings",
         f"{fmt(float(np.expm1(row['log_prev_year_filings'])))} cases"
         if context["similar_filings_found"] else "Tamil Nadu typical value", "data"),
    ]
    labels = _json("inputs")["labels"]
    return [{"input": k, "label": labels.get(k, k), "value": v, "source": src} for k, v, src in out]


def register_tareekh(app, limit: Callable[..., None] = lambda *_a, **_k: None) -> None:
    router = APIRouter(prefix="/api/model")

    @router.get("/options")
    def options(request: Request):
        limit(request, "model", MODEL_PER_MINUTE)
        inputs = _json("inputs")
        return {"question": inputs["question"], "model": inputs["model"],
                "districts": inputs["districts"], "months": inputs["months"],
                "topics": inputs["topics"],
                "kinds": [{k: kind[k] for k in KIND_FIELDS} for kind in inputs["kinds"]],
                "kinds_cover_2017": inputs["kinds_cover_2017"],
                "test": {k: _json("metadata")["test_metrics"][k] for k in ("n", "auc", "accuracy")},
                "model_info": inputs["model_info"],
                "notice": NOTICE, "credit": CREDIT}

    @router.post("/predict")
    def predict(body: PredictIn, request: Request):
        limit(request, "model", MODEL_PER_MINUTE)
        row, context = build_row(body)
        probability, effects = predict_row(row)
        kind = _lookups()["kinds"][body.kind]
        curves = _json("analytics")["tamil_nadu"]["still_open_curves"]
        curve = curves.get(kind["case_type"])
        return {
            "probability": probability,
            "kind": {k: kind[k] for k in KIND_FIELDS},
            "district": body.district, "filing_month": body.filing_month,
            "effects": effects, **context,
            "used_inputs": used_inputs(row, kind, context),
            "model_info": _json("inputs")["model_info"],
            "still_open": None if curve is None else {"label": curve["label"],
                                                     "months": curve["still_open"],
                                                     "median_days": curve["median_days"]},
            "notice": NOTICE,
        }

    @router.get("/sample")
    def sample(request: Request, seed: int | None = None):
        """A real 2017 case the model never saw, with its prediction and what happened."""
        limit(request, "model", MODEL_PER_MINUTE)
        cases = _json("test_cases")
        case = (random.Random(seed) if seed is not None else random).choice(cases)
        probability, effects = predict_row(case)
        return {"case": {k: case[k] for k in ("id", "title", "law_detail", "case_type_name",
                                              "court_level", "district", "filing_month",
                                              "filed", "topic", "variant")},
                "probability": probability, "effects": effects[:5],
                "actual": {"within_1y": bool(case["within_1y"]), "ended": case["ended"],
                           "observed_days": case["observed_days"]},
                "notice": NOTICE}

    @router.get("/analytics")
    def analytics(request: Request):
        limit(request, "model", MODEL_PER_MINUTE)
        return {**_json("analytics"), "credit": CREDIT}

    app.include_router(router)
