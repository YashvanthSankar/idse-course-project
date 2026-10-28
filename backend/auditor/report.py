"""Three-page, print-ready case file for a closed investigation."""

from io import BytesIO
from textwrap import wrap

import matplotlib

matplotlib.use("Agg")  # Reports are rendered by the server, without a display.

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.backends.backend_pdf import PdfPages

from auditor.charts import COLORS
from auditor.store import CaseSession

BG = COLORS["ink_950"]
PAPER = COLORS["paper"]
AMBER = COLORS["amber"]
RED = COLORS["red"]
CYAN = COLORS["cyan"]
MUTED = COLORS["muted"]
LINE = COLORS["line"]


def _page(title: str, number: int):
    fig = plt.figure(figsize=(11.7, 8.3), facecolor=BG)
    fig.text(0.055, 0.925, "OUTLIER  /  CONFIDENTIAL", color=AMBER, size=10, weight="bold")
    fig.text(0.055, 0.865, title, color=PAPER, size=27, weight="bold")
    fig.add_artist(plt.Line2D([0.055, 0.945], [0.84, 0.84], color=LINE, transform=fig.transFigure))
    fig.text(0.055, 0.035, f"OUTLIER · Bureau of Forensic Audit, Mumbai · page {number}/3",
             color=MUTED, size=9)
    return fig


def _axes(fig, rect):
    ax = fig.add_axes(rect, facecolor=BG)
    ax.tick_params(colors=MUTED, labelsize=9)
    for spine in ax.spines.values():
        spine.set_color(LINE)
    ax.grid(color=LINE, alpha=0.5, linewidth=0.6)
    ax.set_axisbelow(True)
    return ax


def _label(ax, x: str, y: str):
    ax.set_xlabel(x, color=PAPER, size=10)
    ax.set_ylabel(y, color=PAPER, size=10)


def _case_file(session: CaseSession):
    meta = session.bundle.meta
    verdict = session.verdict
    fig = _page("Case File", 1)
    fig.text(0.055, 0.77, meta.title, color=PAPER, size=20)
    fig.text(0.055, 0.72, f"CASE {meta.case_id}  /  LEVEL {meta.level}", color=MUTED, size=11)
    fig.text(0.65, 0.75, "GUILTY" if verdict.correct else "WRONG SUSPECT",
             color=RED, size=22, weight="bold")
    fig.text(0.65, 0.69, f"TOTAL SCORE  {verdict.score:,}", color=AMBER, size=14)

    fig.text(0.055, 0.62, "SCORE BREAKDOWN", color=CYAN, size=11, weight="bold")
    for i, (name, points) in enumerate(verdict.breakdown.items()):
        y = 0.58 - i * 0.042
        fig.text(0.055, y, name.replace("_", " ").title(), color=PAPER, size=10)
        fig.text(0.37, y, f"{points:+,}", color=AMBER, size=10, ha="right")
        fig.add_artist(plt.Line2D([0.055, 0.38], [y - 0.012, y - 0.012],
                                  color=LINE, transform=fig.transFigure))

    fig.text(0.49, 0.62, "THE FRAUDSTER", color=CYAN, size=11, weight="bold")
    fig.text(0.49, 0.575, verdict.fraudster.name, color=PAPER, size=16)
    fig.text(0.49, 0.535, verdict.fraudster.role, color=MUTED, size=10)
    fig.text(0.055, 0.365, "THE SCHEME", color=CYAN, size=11, weight="bold")
    for i, line in enumerate(wrap(verdict.explanation, width=105)):
        fig.text(0.055, 0.325 - i * 0.027, line, color=PAPER, size=10)
    fig.text(0.055, 0.19, "EVIDENCE ATTACHED", color=CYAN, size=11, weight="bold")
    for i, item in enumerate(verdict.evidence):
        title = session.results[item.result_id].title if item.result_id in session.results else item.tool_id
        fig.text(0.055, 0.15 - i * 0.037,
                 f"{i + 1:02d}  {title}   /   {item.grade.upper()}   /   {item.points:+d} points",
                 color=AMBER if item.grade == "strong" else PAPER, size=10)
    return fig


def _ledger(session: CaseSession, names: dict[str, str]):
    df = session.bundle.df.copy()
    truth = session.bundle.truth
    fig = _page("The Ledger", 2)
    fig.text(0.055, 0.79, "Every claim. The red marks are the proven fraud rows.",
             color=MUTED, size=11)
    dates = pd.to_datetime(df["date"]) + pd.to_timedelta(df["hour"], unit="h")
    theirs = df["employee_id"].eq(truth.fraudster_id)
    fraud = df["txn_id"].isin(truth.fraud_txn_ids)
    ax = _axes(fig, [0.09, 0.37, 0.85, 0.38])
    ax.scatter(dates[~theirs], df.loc[~theirs, "amount"], s=7, color=MUTED,
               alpha=0.35, label="Other claims")
    ax.scatter(dates[theirs], df.loc[theirs, "amount"], s=14, color=AMBER,
               alpha=0.7, label="Fraudster's claims")
    ax.scatter(dates[fraud], df.loc[fraud, "amount"], s=70, color=RED,
               marker="x", linewidth=1.6, label="Fraud rows", zorder=5)
    ax.set_yscale("log")
    _label(ax, "Claim date", "Amount (INR, log scale)")
    ax.legend(facecolor=BG, edgecolor=LINE, labelcolor=PAPER, fontsize=8, loc="upper left")
    fig.autofmt_xdate()

    ax2 = _axes(fig, [0.09, 0.11, 0.85, 0.18])
    df["employee_name"] = df["employee_id"].map(names)
    order = [names[s.id] for s in session.bundle.meta.suspects]
    sns.boxplot(data=df, x="employee_name", y="amount", order=order, ax=ax2,
                color=CYAN, fliersize=1, linewidth=0.8)
    ax2.set_yscale("log")
    _label(ax2, "Employee", "Amount (INR)")
    ax2.tick_params(axis="x", labelrotation=15)
    return fig


def _technique(session: CaseSession, names: dict[str, str]):
    df = session.bundle.df.copy()
    truth = session.bundle.truth
    scheme = truth.scheme
    titles = {
        "big_invoice": "Compare each person with their own normal",
        "duplicates": "A receipt paid twice leaves twins",
        "fabricated": "Invented numbers lose their natural shape",
        "weekend": "The office slept; the card did not",
        "inflated_ratio": "Expenses drift above the honest line",
        "under_limit": "Just below the limit, after hours",
    }
    fig = _page("The Technique", 3)
    fig.text(0.055, 0.785, titles[scheme], color=AMBER, size=14)
    ax = _axes(fig, [0.12, 0.16, 0.78, 0.55])
    ids = list(df["employee_id"].unique())
    fraud = df["txn_id"].isin(truth.fraud_txn_ids)
    if scheme == "big_invoice":
        log_amount = np.log10(df["amount"])
        groups = log_amount.groupby([df["employee_id"], df["category"]])
        z = ((log_amount - groups.transform("mean")) / groups.transform("std")).fillna(0)
        positions = df["employee_id"].map({eid: i for i, eid in enumerate(ids)})
        sns.stripplot(x=z, y=positions, ax=ax, color=MUTED, size=2, alpha=0.45, jitter=0.2)
        ax.scatter(z[fraud], positions[fraud], color=RED, marker="x", s=70, zorder=5)
        for threshold in (-3, 3):
            ax.axvline(threshold, color=AMBER, linestyle="--")
        ax.set_yticks(range(len(ids)), [names[eid] for eid in ids])
        _label(ax, "Within-person, within-category log-amount z-score", "Employee")
    elif scheme == "duplicates":
        claims = df[["txn_id", "employee_id", "vendor", "amount", "date"]].copy()
        claims["date"] = pd.to_datetime(claims["date"])
        pairs = claims.merge(claims, on=["employee_id", "vendor", "amount"], suffixes=("_a", "_b"))
        gap = (pairs["date_b"] - pairs["date_a"]).dt.days
        for row in pairs[(gap > 0) & (gap <= 7)].itertuples():
            y = ids.index(row.employee_id)
            color = RED if row.txn_id_b in truth.fraud_txn_ids else CYAN
            ax.plot([row.date_a, row.date_b], [y, y], color=color, marker="o", linewidth=1.5)
        ax.set_yticks(range(len(ids)), [names[eid] for eid in ids])
        _label(ax, "Original and matching claim dates", "Employee")
        fig.autofmt_xdate()
    elif scheme == "fabricated":
        for i, eid in enumerate(ids):
            amounts = df.loc[df["employee_id"].eq(eid), "amount"]
            digits = amounts.map(lambda value: int(str(value).replace(".", "").lstrip("0")[0]))
            shares = digits.value_counts(normalize=True).reindex(range(1, 10), fill_value=0)
            ax.bar(np.arange(1, 10) + (i - 2) * 0.14, shares, width=0.14,
                   color=AMBER if eid == truth.fraudster_id else MUTED,
                   alpha=0.9 if eid == truth.fraudster_id else 0.35)
        ax.plot(range(1, 10), np.log10(1 + 1 / np.arange(1, 10)), color=CYAN,
                marker="o", label="Benford expectation")
        _label(ax, "First digit", "Share of claims")
        ax.legend(facecolor=BG, edgecolor=LINE, labelcolor=PAPER)
    elif scheme == "weekend":
        weekend = pd.to_datetime(df["date"]).dt.day_of_week.ge(5)
        shares = weekend.groupby(df["employee_id"]).mean().reindex(ids).fillna(0)
        ax.bar([names[eid] for eid in ids], shares * 100,
               color=[RED if eid == truth.fraudster_id else CYAN for eid in ids])
        _label(ax, "Employee", "Weekend claims (%)")
    elif scheme == "inflated_ratio":
        x = np.log10(df["revenue"].clip(lower=1))
        y = np.log10(df["amount"].clip(lower=1))
        slope, intercept = np.polyfit(x[~fraud], y[~fraud], 1)
        ax.scatter(x, y, s=6, color=MUTED, alpha=0.3)
        ax.scatter(x[fraud], y[fraud], s=25, color=RED, marker="x")
        line = np.linspace(x.min(), x.max(), 100)
        ax.plot(line, slope * line + intercept, color=CYAN, label="OLS honest line")
        _label(ax, "Log revenue (INR)", "Log claim amount (INR)")
        ax.legend(facecolor=BG, edgecolor=LINE, labelcolor=PAPER)
    elif scheme == "under_limit":
        ax.scatter(df["hour"], df["amount"], s=7, color=MUTED, alpha=0.3)
        ax.scatter(df.loc[fraud, "hour"], df.loc[fraud, "amount"],
                   s=40, color=RED, marker="x")
        ax.axhline(50_000, color=AMBER, linestyle="--", label="INR 50,000 approval limit")
        _label(ax, "Hour of claim", "Amount (INR)")
        ax.legend(facecolor=BG, edgecolor=LINE, labelcolor=PAPER)
    return fig


def render_report(session: CaseSession) -> bytes:
    """Render the closed case as a three-page noir PDF."""
    if session.verdict is None:
        raise ValueError("A verdict is required before rendering the case report")
    names = {suspect.id: suspect.name for suspect in session.bundle.meta.suspects}
    output = BytesIO()
    with PdfPages(output) as pdf:
        for fig in (_case_file(session), _ledger(session, names), _technique(session, names)):
            pdf.savefig(fig, facecolor=BG)
            plt.close(fig)
    return output.getvalue()
