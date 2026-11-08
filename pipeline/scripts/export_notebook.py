"""Turn the executed master notebook into what the /model/pipeline page shows.

Reads notebooks/00_full_pipeline.ipynb (run it first) and writes, under game/web/public/pipeline/:
- notebook.json           the notebook as stages: for each "## A1 · title" heading, the
                          explanation (markdown rendered to HTML), the code cells with their
                          printed output, tables and chart images, and the "Takeaway:" line
- figures/<stage>-<n>.png the charts, taken from the notebook's outputs
- 00_full_pipeline.ipynb  a copy, for the download link
- results.json            the model comparison, confusion matrix, calibration and the other
                          numbers the page's results section shows, from reports/*.json and
                          artifacts/site/analytics.json

The site reads only these files, never anything outside game/web.

    uv run python scripts/export_notebook.py
"""

import base64
import json
import re
import shutil
import struct
import sys
from datetime import date
from pathlib import Path

import mistune
import nbformat

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks" / "00_full_pipeline.ipynb"
OUT = ROOT.parent / "game" / "web" / "public" / "pipeline"
REPORTS = ROOT / "reports"
SITE = ROOT / "artifacts" / "site"

STAGE = re.compile(r"^## ([AB]\d+) · (.+)$", re.MULTILINE)
PART = re.compile(r"^# Part ([AB]) · (.+)$", re.MULTILINE)
render = mistune.create_markdown(plugins=["table"])
_STYLE = re.compile(r"<style.*?</style>", re.DOTALL)


def table_html(html: str) -> str:
    """pandas / Styler output without its own <style> block (the page styles tables itself)."""
    html = _STYLE.sub("", html)
    return re.sub(r'\s(?:style|border)="[^"]*"', "", html).strip()


def outputs(cell, stage_id: str, n_images: list[int]) -> dict:
    """The cell's code and its outputs in order: text, tables (HTML) and chart images."""
    blocks: list[dict] = []
    takeaway = None

    def add_text(text: str) -> None:
        nonlocal takeaway
        kept = []
        for line in text.split("\n"):
            if line.startswith("Takeaway:"):
                takeaway = line.removeprefix("Takeaway:").strip()
            else:
                kept.append(line)
        text = "\n".join(kept).strip("\n")
        if not text:
            return
        if blocks and blocks[-1]["type"] == "text":
            blocks[-1]["text"] += "\n" + text
        else:
            blocks.append({"type": "text", "text": text})

    for out in cell.get("outputs", []):
        if out["output_type"] == "stream":
            add_text(out["text"])
        elif out["output_type"] == "error":
            raise SystemExit(f"cell has an error: {out['ename']}: {out['evalue']}")
        elif "data" in out:
            data = out["data"]
            if "image/png" in data:
                n_images[0] += 1
                name = f"{stage_id}-{n_images[0]}.png"
                png = base64.b64decode(data["image/png"])
                (OUT / "figures" / name).write_bytes(png)
                width, height = struct.unpack(">II", png[16:24])  # the PNG header's IHDR chunk
                blocks.append({"type": "image", "src": f"/pipeline/figures/{name}",
                               "width": width, "height": height})
            elif "text/html" in data:
                blocks.append({"type": "table", "html": table_html(data["text/html"])})
            elif "text/plain" in data:
                add_text(data["text/plain"])
    return {"code": cell["source"], "blocks": blocks, "takeaway": takeaway}


def short_model_name(name: str) -> str:
    base = {"baseline: overall rate": "Baseline: overall rate",
            "baseline: rate per case type": "Baseline: rate per case type",
            "baseline: rate per case type x district": "Baseline: case type × district lookup"}
    if name in base:
        return base[name]
    inputs, rest = name.split(" | ")
    family = rest.split(" (")[0].replace("linear SVM", "Linear SVM")
    family = family[0].upper() + family[1:]
    return f"{family}, {'filing basics' if inputs == 'filing basics' else 'with law and section'}"


def results() -> dict:
    r = json.loads((REPORTS / "within_1y_results.json").read_text())
    e = json.loads((REPORTS / "experiments.json").read_text())
    a = json.loads((REPORTS / "analysis.json").read_text())
    d = json.loads((REPORTS / "days_regression.json").read_text())
    site = json.loads((SITE / "analytics.json").read_text())
    meta = json.loads((ROOT / "artifacts" / "within_1y" / "metadata.json").read_text())
    served = r["served"]["name"]
    tn = a["tamil_nadu"]
    return {
        "served": short_model_name(served),
        "test_year": meta["tested_on_filing_year"],
        "train_years": meta["trained_on_filing_years"],
        "models": [{"name": short_model_name(k), "served": k == served, "family": (
            "baseline" if k.startswith("baseline") else k.split(" | ")[1].split(" (")[0]),
            "inputs": "" if k.startswith("baseline") else k.split(" | ")[0],
            **{m: v[m] for m in ("accuracy", "auc", "brier", "log_loss", "n")}}
            for k, v in r["test"].items()],
        "confusion": site["model"]["info"]["confusion"],
        "model_info": site["model"]["info"],
        "calibration": r["served"]["calibration_2017"],
        "importance": r["served"]["permutation_importance_2017"],
        "horizons": {k: {"model_auc": v["model"]["auc"],
                         "baseline_auc": v["baseline: rate per case type"]["auc"],
                         "train": v["train"], "test": v["test"]} for k, v in e["horizons"].items()},
        "drift": e["drift"],
        "weak_case_types": e["weak_spots"]["case_type"][:8],
        "case_type_names": site["case_type_names"],
        "days_regression": d,
        "clusters": {"k": tn["district_clusters"]["k"],
                     "best_silhouette": max(tn["district_clusters"]["silhouette"].values())},
        "cleaning": tn["cleaning"],
        "survivorship": tn["survivorship"],
        "cases": {"national": a["national"]["cases"], "tamil_nadu": tn["cases"]},
        "within_1y_by_year": tn["within_1y_by_year"],
        "still_open_all": tn["still_open_curves"]["all cases"],
    }


def main() -> int:
    nb = nbformat.read(NOTEBOOK, as_version=4)
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "figures").mkdir(parents=True)

    doc = {"generated": str(date.today()), "title": "", "intro_html": "", "setup_code": "",
           "parts": [], "summary_html": "", "checks": None}
    part = stage = None
    n_images = [0]
    for cell in nb.cells:
        if cell.cell_type == "markdown":
            src = cell.source
            if (m := PART.match(src)):
                part = {"id": m.group(1), "title": m.group(2), "stages": []}
                doc["parts"].append(part)
                stage = None
            elif (m := STAGE.match(src)):
                body = src[m.end():].strip()
                stage = {"id": m.group(1), "title": m.group(2), "intro_html": render(body),
                         "cells": [], "takeaway": None}
                part["stages"].append(stage)
            elif src.startswith("## Summary"):
                stage = None
                doc["summary_html"] = render(src.split("\n", 1)[1])
            elif src.startswith("# "):
                title, body = src.split("\n", 1)
                doc["title"] = title[2:].strip()
                doc["intro_html"] = render(body)
        elif cell.cell_type == "code":
            if stage is None and not doc["parts"]:
                doc["setup_code"] = cell.source
                continue
            if stage is None:
                text = "".join(o.get("text", "") for o in cell.get("outputs", []))
                if (m := re.search(r"(\d+) of (\d+) numbers", text)):
                    doc["checks"] = {"agree": int(m.group(1)), "total": int(m.group(2)),
                                     "text": text.strip()}
                continue
            out = outputs(cell, stage["id"], n_images)
            if out["takeaway"]:
                stage["takeaway"] = out.pop("takeaway")
            else:
                out.pop("takeaway")
            stage["cells"].append(out)

    for p in doc["parts"]:
        for s in p["stages"]:
            if not s["takeaway"]:
                raise SystemExit(f"stage {s['id']} has no 'Takeaway:' line")
    (OUT / "notebook.json").write_text(json.dumps(doc, ensure_ascii=False))
    (OUT / "results.json").write_text(json.dumps(results(), ensure_ascii=False))
    shutil.copy(NOTEBOOK, OUT / NOTEBOOK.name)
    n_stages = sum(len(p["stages"]) for p in doc["parts"])
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6
    print(f"{n_stages} stages, {n_images[0]} figures, {size:.1f} MB -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
