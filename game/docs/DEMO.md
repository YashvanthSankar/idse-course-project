# Demo Script (5 minutes)

## Before you present (10 minutes early)
- [ ] Backend running: `cd game/backend && uv run uvicorn auditor.api:app --host 0.0.0.0 --port 8000`
- [ ] Frontend running: `cd game/web && pnpm dev --port 3200` (or the deployed link)
- [ ] Open http://localhost:8000/api/levels once, so the server is warm
- [ ] Laptop and projector on the **same Wi-Fi** as the class (phones join over the network)
- [ ] Projector at 1920×1080, sound on, browser full screen (F11 / ⌃⌘F)
- [ ] Backup: a screen recording of the full loop, in case the Wi-Fi dies

## 1 · The hook (30 s)
Open the title screen. Let the rain and the neon sign do the talking.
> "This is Outlier, a detective game where every clue is real data analysis in Python."

## 2 · Solve a case live (2 min)
**New Case → Case 03 "Too Random To Be True"** (Benford's law is the crowd-pleaser).
1. Read the Chief's memo out loud. It hints at the first digits.
2. Run **Case Summary**: "Nothing obvious."
3. Run **Benford's Law**: one suspect's line is flat. "Real money starts with a 1 about 30% of the time. Invented numbers don't."
4. Open **Under the hood**: "This is the exact Python function that just ran: pandas plus `scipy.stats.chisquare`."
5. Pin two clues, press **B** for the corkboard, drag the red string, and hold to accuse.
6. GUILTY stamp, score, Reveal. Download the **Case Report PDF** (seaborn).

## 3 · Class Mode, the big moment (1.5 min)
**Class Mode → Start a class session.** The room code and QR fill the projector.
> "Everyone, scan this. You're all detectives now."

Pick **Case 1**, 3 minutes, **START**. The leaderboard and the "Asha ran Z-Score Scan" ticker run live.
End the round → podium → **Open Class Autopsy**.

## 4 · The class becomes the dataset (1 min)
Walk through the slides with ← →:
- Solve rate and median time
- Which tools the class used
- **"Does more analysis pay off?"**: Pearson r and the p-value, computed live on *their* data
- Which tool predicts success (chi-square)
- KMeans detective archetypes. Everyone can open their own **Detective Card**.

## 5 · Close (30 s)
> "Everything you saw is Python: numpy generates the cases, pandas and scipy run the tests,
> scikit-learn powers the anomaly hunter and the archetypes, and seaborn makes the report.
> The full analysis is in three notebooks in the repo."

Show `notebooks/02_detection_tools.ipynb` → "Is the game fair?" heatmap.

## If something breaks
| Problem | Fix |
|---|---|
| Phones can't connect | Check they're on the same Wi-Fi, and use the IP URL shown under the QR |
| Charts are slow | Close other tabs; the backend runs in one process by design |
| Hacker Mode slow to start | First load downloads Python (~15 s); open it once before presenting |
