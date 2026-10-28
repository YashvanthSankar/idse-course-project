"""Synthetic classroom telemetry: careful detectives use more tools and are right more often."""

import numpy as np
import pandas as pd

TOOLS = ["summary", "groupby", "zscore", "iqr_box", "duplicates", "benford", "timeseries",
         "regression", "isoforest"]
VISUAL = {t: t != "summary" for t in TOOLS}
COST = {"summary": 1, "groupby": 1, "zscore": 2, "iqr_box": 2, "duplicates": 2, "benford": 3,
        "timeseries": 3, "regression": 4, "isoforest": 5}


def synthetic_events(n_players: int = 200, seed: int = 0, room: str = "TEST") -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    t = 0.0
    for i in range(n_players):
        pid, cid = f"P{i:03d}", f"C{i:03d}"
        skill = rng.uniform()
        rows.append((t, "case_started", pid, cid, room, None, {"level": 6, "seed": 1}))
        n_tools = int(rng.poisson(1 + 8 * skill))
        used = rng.choice(TOOLS, size=n_tools)
        spent = 0
        for tool in used:
            spent += COST[str(tool)]
            rows.append((t, "tool_run", pid, cid, room, str(tool),
                         {"cost": COST[str(tool)], "visual": VISUAL[str(tool)]}))
        if rng.uniform() < 0.1:
            for _ in range(int(rng.integers(3, 8))):
                rows.append((t, "hacker_query", pid, cid, room, None, {}))
        if rng.uniform() < 0.92:
            correct = bool(rng.uniform() < 0.1 + 0.85 * skill)
            elapsed = int(60 + 420 * skill * rng.uniform(0.5, 1.2))
            rows.append((t, "accused", pid, cid, room, None,
                         {"correct": correct, "score": 1000 * correct + 200 * n_tools * correct,
                          "elapsed_s": elapsed, "budget_left": max(0, 14 - spent), "level": 6}))
        t += 1
    return pd.DataFrame(rows, columns=["ts", "type", "player_id", "case_id", "room_code",
                                       "tool_id", "payload"])
