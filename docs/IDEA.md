# THE AUDITOR

> *"Every number tells a story. Some of them lie."*

## The idea in one line
A noir detective web game where you catch corporate fraudsters using **real Python data analysis**:
numpy, pandas, scipy, scikit-learn, Plotly and seaborn.

## The story
Mumbai, 2 AM, monsoon rain on the window. You're a rookie forensic auditor. Each case is a company's
transaction ledger and five suspects, and one of them is cooking the books. Your desk lamp, a corkboard,
red string and a kit of data science tools are all you have to find them.

## How you play
1. **Briefing:** the Chief hands you a case file and hints at what's wrong.
2. **Investigate:** use detective tools, and every tool is a real analysis running in Python:
   - Z-Score Scan and Box Plots → outliers
   - Twin Finder → duplicate invoices
   - **Benford's Law** → made-up numbers (real auditors use this test)
   - Timeline → suspicious weekend spending
   - Margin Model (regression) → inflated expenses
   - Anomaly Hunter (IsolationForest, ML) → the ghost vendor
3. **Pin evidence:** drag charts onto the corkboard and connect them to a suspect with red string.
4. **Accuse:** pick your suspect and attach 2 pieces of evidence. One shot, no take-backs.
5. **Verdict and Reveal:** the GUILTY stamp slams down, your score counts up, and the game shows exactly how
   the fraud was hidden and which technique catches it.

Every tool costs budget points, so picking the right analysis is the strategy.

## Why it's more than a quiz
- **It teaches the syllabus:** each level is solved by one core technique, from simple stats up to ML.
- **Red herrings:** the CEO's big but honest spending and a Diwali bonus week teach that *an outlier isn't automatically fraud*.
- **Every case is unique:** numpy generates fresh data each time, so there's no answer key to copy.
- **"Under the hood":** every result shows the exact Python code that produced it.
- **The fraudster adapts:** in endless mode, the game watches which tools you rely on and hides from them.

## The big moment: Class Mode
- The professor puts a QR code on the projector, and **the whole class (200 students) joins from their phones**.
- Everyone races through the same case while a live leaderboard and activity ticker play on the big screen.
- Then comes the **Class Autopsy**: pandas analyzes the class's own play data live. Which tools did people use?
  Did using more tools mean more correct answers? Which tool predicts success?
  **The class becomes the dataset.**
- Every student gets a **Detective Card**, grouped by KMeans into a play style (The Statistician, The Gambler,
  The Hacker, The Visualizer).

## Extras
- **Hacker Mode:** type your own pandas code, running as real Python inside the browser (Pyodide).
- **Case Report PDF:** a seaborn-made report of your investigation.

## Tech in one breath
**Python brain** (FastAPI + numpy/pandas/scipy/scikit-learn/plotly/seaborn) does all the data science.
**Next.js game UI** (Tailwind, Framer Motion, Plotly charts, dnd-kit corkboard, Howler sound) makes it feel
like a real web game. Class Mode runs on WebSockets.

## Docs
- [DESIGN.md](DESIGN.md): full game design (rules, levels, tools, UI)
- [PLAN.md](PLAN.md): build plan (27 tasks)
- [TODO.md](TODO.md): progress checklist
