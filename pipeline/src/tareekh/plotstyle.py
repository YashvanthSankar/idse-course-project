"""One look for every notebook chart (matplotlib).

Colours come from a validated categorical palette, used in fixed order (never cycled), and a
single blue ramp for magnitude. Text stays in ink colours, never the series colour; grids and
axes recede; one y-axis per chart.
"""

import matplotlib as mpl

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6",
          "#e34948"]
BLUE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
NEUTRAL = "#b9b8b2"


def apply() -> None:
    mpl.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "figure.dpi": 110, "savefig.dpi": 160, "figure.figsize": (8, 4.2),
        "font.size": 10, "axes.titlesize": 12, "axes.titleweight": "bold",
        "axes.titlelocation": "left", "axes.labelcolor": INK_2, "text.color": INK,
        "xtick.color": INK_2, "ytick.color": INK_2, "axes.edgecolor": GRID,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
        "axes.axisbelow": True, "lines.linewidth": 2, "legend.frameon": False,
        "axes.prop_cycle": mpl.cycler(color=SERIES),
    })


def hbar(ax, labels, values, color=SERIES[0], fmt="{:.0%}", highlight=None):
    """Horizontal bars, largest at the top, each labelled with its value in ink."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    labels = [labels[i] for i in order]
    values = [values[i] for i in order]
    colors = [SERIES[1] if highlight and lab in highlight else color for lab in labels]
    bars = ax.barh(labels, values, color=colors, height=0.7, edgecolor=SURFACE, linewidth=2)
    for bar, value in zip(bars, values, strict=True):
        ax.text(bar.get_width(), bar.get_y() + bar.get_height() / 2, " " + fmt.format(value),
                va="center", fontsize=8, color=INK_2)
    ax.grid(axis="y", visible=False)
    return ax


def save(fig, name: str, folder) -> None:
    """Also write the figure to reports/figures for the write-up (the notebook still shows it)."""
    folder.mkdir(parents=True, exist_ok=True)
    fig.savefig(folder / f"{name}.png", bbox_inches="tight")
