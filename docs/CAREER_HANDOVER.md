# Career Mode: Handover

Everything you need to deploy Career Mode, and every gameplay rule in one place. The full design, with the
reasoning behind each rule and all fourteen companies' stories, is in [CAREER.md](CAREER.md).

Branch: `career-mode` (three commits on top of `main`: engine, screens, docs).

---

## 1. Deploying

**Nothing new to install.** Career Mode uses the stack that's already live: FastAPI + pandas + sklearn +
SQLAlchemy on the backend, Next.js on the web. `requirements.txt`, `pyproject.toml` and `package.json` have no
new packages.

### 1.1 Database

Careers are saved in the **same database as telemetry**, chosen the same way:

| Env var | Used for |
|---|---|
| `DATABASE_URL` | Postgres (Neon). If set, it wins. `postgres://` URLs are rewritten to the psycopg driver automatically. |
| `AUDITOR_DB` | SQLite file path, used when `DATABASE_URL` isn't set (Fly sets `/data/auditor.db`). |
| neither | `auditor.db` locally, `/tmp/auditor.db` on Vercel (lost on cold start, so set `DATABASE_URL` in production). |

**The table creates itself** on the first backend start (`CREATE TABLE IF NOT EXISTS` through SQLAlchemy). No
migration step. If the database user isn't allowed to create tables, run this once:

```sql
CREATE TABLE IF NOT EXISTS careers (
    code    VARCHAR(16) PRIMARY KEY,   -- e.g. 'JBS-GFV', what the player types to continue
    state   TEXT,                       -- the whole career as JSON
    updated DOUBLE PRECISION            -- unix seconds of the last save
);
```

The existing `events` telemetry table is untouched.

### 1.2 Environment variables

| Where | Var | Value | Effect |
|---|---|---|---|
| backend | `DATABASE_URL` | Neon connection string | Where careers (and telemetry) are saved. Needed in production. |
| backend | `AUDITOR_CAREER` | unset, or `0` | `0` turns off every `/api/career` route. |
| backend | `AUDITOR_DEBUG` | **leave unset in production** | `1` turns on the debug-jump and truth routes (cheats). |
| web | `NEXT_PUBLIC_API_URL` | backend URL | Unchanged from today. |
| web | `NEXT_PUBLIC_CAREER` | unset, or `0` | `0` hides CAREER from the title menu. Rebuild needed (it's baked in at build time). |

Career Mode is **on by default**. To ship the code but keep it hidden, set both flags to `0`.

### 1.3 Steps

1. Merge `career-mode` into `main` (or deploy the branch as a preview first).
2. Backend: deploy as usual (Vercel `backend/index.py`, or `fly deploy` from `backend/`). Make sure
   `DATABASE_URL` is set and `AUDITOR_DEBUG` is not.
3. Web: deploy as usual on Vercel.
4. Smoke test: open `/career` → skip the prologue → OPEN THE ENVELOPES → sign an offer → play a case. Note the
   career code on the hub, open `/career` in a private window, enter the code, and check the same career loads.
   That proves the database is saving.

### 1.4 One thing to know about hosting

Each backend instance keeps a small in-memory cache of careers (and, as today, the live case sessions). That's
fine on Fly (one machine) and on Vercel while one warm instance serves traffic, which is how Quick Case already
works. If the backend is ever scaled to several instances at once, the cache in
`backend/auditor/career/storage.py` should be removed so every read goes to the database. If a case session
is lost (cold start), the career hub rebuilds the case automatically. The player just restarts that case.

### 1.5 Checks before merging

```bash
cd backend && uv run pytest              # 322 tests, includes the slow fairness runs
cd web && pnpm lint && pnpm test && pnpm build
cd web && pnpm exec playwright test --workers=1   # 39 e2e tests; needs the backend on :8000 with AUDITOR_DEBUG=1
```

Run e2e with `--workers=1`. In parallel, some tests time out on a laptop, and they do on `main` too.

---

## 2. Gameplay Rules (quick reference)

### 2.1 The ladder

**14 companies:** 3 Small → 5 Mid → 3 Large → 2 Very large → the Final (the Kaveri Inquiry).

| Tier | Companies | Ledger rows | Suspects per case | Base salary | Raise OK / Good / Exc | Salary ceiling |
|---|---|---|---|---|---|---|
| Small | Lakshmi Sweets & Caterers, Konkan Coast Travels, Pixel Garage Studios | 1,000 | 5 | ₹6 LPA | 20 / 50 / 100% | ₹15 LPA |
| Mid | Sterling Mercantile, Bluewave Pharma Distributors, Horizon Realty Developers, Malabar Textiles International, Saffron Media Networks | 1,500 | 5 | ₹15 LPA | 10 / 25 / 50% | ₹40 LPA |
| Large | Arabian Sea Shipping Co., Indus Steel & Infrastructure, Meridian Hospitals Group | 2,500 | 5 | ₹40 LPA | 10 / 20 / 30% | ₹1.5 Cr |
| Very large | Vasundhara Industries Group, Deccan Crown Bank | 3,500 | 7 | ₹1.5 Cr | 10 / 15 / 25% | ₹5 Cr |
| Final | The Kaveri Inquiry | 5,000 | 10 | ₹5 Cr | — | — |

- At the start, **all 3 Small companies** offer a contract. The player picks one.
- Each company has a **fixed roster of 20 people** (the same names every career), plus a CEO at some firms.
- Salary is **status only** for now. It buys nothing.
- On promotion, the player starts at the new tier's base salary, or keeps their current salary if it's higher.

### 2.2 Contracts

- **1 contract = 1 year = 5 cases.**
  - Small, Mid and Large: easy, easy, medium, medium, hard.
  - Very large: easy, easy, medium, hard, **very hard** (two fraudsters in one case).
  - The Final: 3 very hard cases.
- Harder cases hide the fraud better: a clear briefing becomes a hint, then a vague one; the budget has fewer
  spare coins; more red herrings (honest people who look odd).
- The **Case Summary tool runs free** at the start of every career case.
- **No TRY AGAIN in Career.** A wrong accusation still scores points, and the player moves to the next case.
- Points are shown after every case, with the contract so far ("Case 3 of 5 · average 84 · Good").

### 2.3 Rating a case (0–100)

| Part | Points | How it's scored |
|---|---|---|
| Verdict | 40 | Accused the right person. In two-fraudster cases, 20 for each. |
| Evidence | 25 | Best clue from a tool that catches this fraud = 15, plus a backup clue that supports it = 10 (weaker clues score less). |
| Tool judgment | 20 | 20 × (coins spent on tools that catch this fraud ÷ coins spent). |
| Efficiency | 15 | 15 × (cost of the intended tools ÷ coins spent), capped at 15. |

### 2.4 Rating a contract

The average of its 5 case ratings, put into a band:

| Band | Rule |
|---|---|
| **Exceptional** | 88+ **and** the hard case solved |
| **Good** | 70–87 |
| **OK** | 60–69, **or** every accusation was right (whatever the score) |
| **Bad** | below 60 |

### 2.5 Promotion, offers and firing

| Move | What it takes |
|---|---|
| Small → Mid | 1 Good contract. An Exceptional also brings 1 Large offer straight away. |
| Mid → Large | Good at **2 different** Mid companies. An OK pauses the streak; it doesn't reset it. |
| Large → Very large | Exceptional at **2 of the 3** Large companies. |
| Very large → Final | Exceptional at **both** Very large companies. |

- **Bad contract:** no new offers, but the player can restart the same company (it counts as a new year).
- **2 Bad contracts in a row at the same company: fired.** The player drops one tier, at that tier's base salary. At Small (nowhere
  lower to go), they're only banned from that one firm.
- Getting fired resets the promotion streaks.
- **No resigning** mid-contract. No limit on offers held.
- **Practice replays** of a finished company give no credit, no raise and no streak.

### 2.6 The cameos (the three old colleagues)

- Three fixed characters: **Imran Sheikh, Tara Pinto, Meher Contractor**. The player meets **all three at their
  first company**.
- Every later company has **1 cameo (60%) or 2 (40%)**. Each time someone appears, their chance to appear again
  is halved, so they rotate.
- They greet the player on day one and name **only the last company you worked at together**
  (e.g. "Last time it was Konkan Coast Travels").
- They can stand in the lineup but are **never guilty until the Final**.

### 2.7 The Final

- **Played once only.** All 10 suspects, and all 3 cameos are present.
- In **case 3**, one of the two fraudsters is a cameo, chosen at random per career (fixed once chosen).
- **Only case 3 decides the ending.**
  - Cameo caught → the **confession** cutscene → good ending: ₹5 Cr and the title **Chief Auditor**.
  - Cameo missed → the **escape** cutscene → bitter ending: salary unchanged.
- Both cutscenes replay this player's real history: every company they shared with that cameo, and how many
  times the cameo stood in their lineup.
- After the cutscene: **free play**. Every company opens for practice; the Final can't be replayed.
  **Retire** starts a new career with a new code.

### 2.8 Saving and screens

- Each career gets a **code** like `JBS-GFV`, saved in the database. This browser remembers it, and typing it
  on another device continues the same career.
- Title menu: **QUICK CASE · CAREER · CLASS MODE · MANUAL**, with Options behind the gear icon.
- The Detective Card shows the career **title** only (e.g. Chief Auditor).
- Quick Case and Class Mode are unchanged and never call career code.

---

## 3. Where the code is

| Part | Files |
|---|---|
| Rules engine | `backend/auditor/career/`: `catalog.py` (tiers, salaries, companies, cameos), `people.py` (rosters), `cases.py` (contract plans, case building), `rating.py` (0–100 and bands), `rules.py` (promotion, firing, the Final), `storage.py` (the `careers` table), `routes.py` (`/api/career`) |
| Screens | `web/app/career/`, `web/components/career/`, `web/components/verdict/CareerVerdictScreen.tsx` |
| Tests | `backend/tests/test_career_*.py`, `web/lib/career.test.ts`, `web/e2e/career.spec.ts` |

To change a number (a band cut-off, a salary, a raise), edit `catalog.py` or `rating.py`. The tests will tell
you if a change breaks fairness.

## 4. Still open

- **Calibration:** the band cut-offs haven't been checked with simulated players yet. Target: a careful
  player reaches Exceptional ~80% of the time at Small/Mid and ~30–40% at Large and above.
- **Salary as a resource:** status only for now.
