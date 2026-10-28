# 🕵️ THE AUDITOR

> *"Every number tells a story. Some of them lie."*

A noir detective web game where you catch corporate fraudsters using **real Python data analysis**:
numpy, pandas, scipy, scikit-learn, Plotly and seaborn. Built for the **IDSE (Introduction to Data
Science for Engineers)** course.

Mumbai, 2 AM, monsoon. You're a rookie forensic auditor with a ledger, five suspects and a kit of data
science tools. One of them is cooking the books. Find out who before the budget runs out.

## ✨ Highlights

- **Every tool is real Python analysis:** Z-scores, box plots, duplicate detection, **Benford's Law**,
  time series, regression and IsolationForest (ML), each showing the exact code that ran ("Under the hood").
- **Procedural cases:** numpy generates fresh data every game, so there's no answer key.
- **Red herrings** (the CEO's big but honest spending, the Diwali bonus week) teach that *an outlier isn't automatically fraud*.
- **Corkboard and red string:** pin charts as evidence, connect them to a suspect and make your accusation.
- **Class Mode:** 200 students join from their phones via QR, race on a live leaderboard, then the
  **Class Autopsy** analyzes the class's own play data with pandas. *The class becomes the dataset.*
- **Detective Cards:** KMeans groups players into play styles: The Statistician, The Gambler, The Hacker, The Visualizer.
- **Hacker Mode:** write your own pandas, running as real Python in the browser (Pyodide).

## 🧠 How Python powers every move

| Game action | Python |
|---|---|
| Generate a case | `numpy.random.default_rng`, `pandas.DataFrame` |
| Z-Score Scan / Box Plot | `groupby().transform`, z-scores, IQR |
| Twin Finder | self-`merge` on (employee, vendor, amount) |
| Benford's Law | first-digit distribution + `scipy.stats.chisquare` |
| Pattern Matrix | `pd.crosstab` + `scipy.stats.chi2_contingency` |
| Timeline | `resample`, weekend share |
| Margin Model | `sklearn.linear_model.LinearRegression`, residual t-test |
| Anomaly Hunter | `sklearn.ensemble.IsolationForest` |
| Charts | `plotly` figures built in Python, rendered in the browser |
| Class Autopsy | `pd.read_sql` over telemetry, Pearson r, chi-square |
| Detective Cards | `StandardScaler` + `KMeans` |
| Case Report | `seaborn` + `matplotlib` PDF |

## 🏗️ Architecture

```
 Browser (Next.js game UI)  ◄── REST + WebSocket ──►  Python brain (FastAPI)
 Tailwind · Framer Motion                              numpy · pandas · scipy
 Plotly · dnd-kit · Web Audio                          scikit-learn · plotly · seaborn
                                                       SQLite telemetry → pandas
```

```
idse-game/
├── backend/     # Python package `auditor` + FastAPI API
├── web/         # Next.js game frontend
├── notebooks/   # narrated notebooks: generator, detection tools, class autopsy
└── docs/        # IDEA, DESIGN, PLAN, TODO
```

## 🚀 Run locally

**Backend** (Python 3.12 via [uv](https://docs.astral.sh/uv/)):
```bash
cd backend
uv sync
uv run uvicorn auditor.api:app --reload      # http://localhost:8000/docs
uv run pytest                                 # tests
```

**Frontend** (Node 20+, pnpm):
```bash
cd web
pnpm install
pnpm dev                                      # http://localhost:3000
pnpm test                                     # unit tests
```

## 📚 Docs

- [docs/IDEA.md](docs/IDEA.md): the game in brief
- [docs/DESIGN.md](docs/DESIGN.md): full game design (rules, levels, tools, UI)
- [docs/PLAN.md](docs/PLAN.md): build plan
- [docs/TODO.md](docs/TODO.md): progress checklist

## 🚧 Status

Under active development. Track progress in [docs/TODO.md](docs/TODO.md).
