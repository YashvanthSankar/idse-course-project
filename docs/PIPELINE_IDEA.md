# Idea: Data Science Pipelines in OUTLIER

> Status: idea only, nothing built yet.

## What a pipeline is

A pipeline is a chain of steps where each step's output feeds the next, e.g.
`clean → transform → model → evaluate`. In scikit-learn it is a `Pipeline` object:

```python
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

pipe = Pipeline([
    ("impute", SimpleImputer(strategy="median")),
    ("scale",  StandardScaler()),
    ("detect", IsolationForest(random_state=0)),
])
```

Why it matters: the steps run the same way every time, preprocessing is fit only on training
data (so test data can't leak into it), and the whole chain can be tuned as one object.

## Three ways to bring it into the game

### 1. A new case where one tool is not enough (recommended)

The fraud only appears after the data is cleaned and transformed, so the player has to chain steps.

- **The ledger is messy:** missing amounts, mixed units ("₹4.2 lakh", "420000"),
  and duplicate vendor names ("Sharma Traders" / "SHARMA TRADERS ").
- **The trap:** running IsolationForest on the raw data flags the noise, not the fraudster.
- **The mechanic:** a pipeline workbench where the player drags steps into order:
  **Clean → Normalise → Encode → Detect**. Only a sensible order exposes the fraudster.
- **The lesson:** preprocessing is part of the analysis, not a chore before it.

### 2. A data leakage case

A rival auditor's report "proves" an innocent suspect is guilty. Their model was fit on the
whole dataset, test rows included, which is leakage. The player rebuilds the analysis as a
proper `Pipeline` with a train/test split, and the accusation falls apart. This fits the
game's theme: *an outlier is a question, not an answer.*

### 3. A pipeline view in "Under the hood"

The smallest change: show each existing tool as its chain of steps (for example, Ghost Vendor as
`SimpleImputer → StandardScaler → IsolationForest`). This adds teaching value but no new gameplay.

## Rough build plan (for option 1)

| Area | Work |
|---|---|
| Backend | New level generator that produces a messy ledger; a tool that runs the player's chosen steps as a scikit-learn `Pipeline` |
| Frontend | Drag-to-order step builder on the investigation screen |
| Fairness tests | Same standard as the other cases: the correct pipeline catches the fraudster in at least 19 of 20 random cases, and wrong step orders do not |
| Career Mode | A late case at the large companies, where difficulty already rises |

## Open questions

- Free-form step ordering, or a fixed menu of a few pipelines to choose between?
- Should a wrong pipeline cost a coin, like other tools?
- Is option 2 (leakage) its own case, or a twist inside option 1?
