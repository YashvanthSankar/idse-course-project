# OUTLIER: Career Mode

> *"Small shops first, kid. Everyone thinks they're too clever to get caught. The big ones just hide it better."*
> R. Desai, Chief Auditor

Career Mode turns Outlier from a list of levels into a career. You start with offer letters from three small
businesses, work your way up through mid, large and very large firms, and finish with the Final. The seven
current levels stay in the game as **Quick Case** (practice), unchanged.

Class Mode is out of scope for this document.

---

## 1. The Career Loop

```
Prologue → Offer desk (letters) → accept a contract
   → 5 cases at that company (same staff, harder each case)
   → Appraisal: rating, salary hike, new offers
   → Offer desk → …
   → The Final (3 very hard cases) → Chief Auditor
```

- **One contract = one calendar year** at one company. The appraisal at the end of the year sets your rating,
  your hike and your next offers.
- **The staff stay the same for the whole contract.** By case 5 you know everyone's normal spending; that
  knowledge is part of the skill.
- **Progress is saved after every case**, on the server (Neon Postgres), under a short **career code** the
  player can enter on any device. A player can stop in the middle of a contract and pick it up later.
- **No resigning.** A contract runs its 5 cases; closing the app pauses it.
- **One career per player.** *Retire* ends it (the career is kept on record) and starts a new one.

---

## 2. The Ladder

| Tier | Companies | Ledger rows | Staff roster | Suspects per case | Tools available |
|---|---|---|---|---|---|
| Small | 3 | 1,000 | 20 (+ 3 cameos at your first) | 5 | Summary, Pattern Matrix, Z-Score, Box & Whisker, Twin Finder |
| Mid | 5 | 1,500 | 20 + 1–2 cameos | 5 | + Benford's Law, Timeline, Margin Model |
| Large | 3 | 2,500 | 20 + 1–2 cameos | 5 | + Anomaly Hunter (all tools) |
| Very large | 2 | 3,500 | 20 + 1–2 cameos | 7 | all tools |
| The Final | 1 | 5,000 | 20 + all 3 cameos | 10 | all tools |

Each company has a fixed **staff roster** (the same people in every contract and every career); each case
draws its suspects from it.

All six techniques are taught at Small and Mid, so a player who never gets past Mid still meets everything the
course grades. Large and above add scale, red herrings, vague briefings and combined frauds, not new required
techniques.

### 2.1 Contract structure

| Tier | Cases |
|---|---|
| Small, Mid, Large | Easy · Easy · Medium · Medium · Hard |
| Very large | Easy · Easy · Medium · Hard · Very hard |
| The Final | Very hard · Very hard · Very hard |

| Difficulty | Fraud | Briefing | Budget | Herrings |
|---|---|---|---|---|
| Easy | the company's signature scheme, obvious | names the clue | generous | none |
| Medium | signature scheme, subtler, or a second scheme | hints | normal | one |
| Hard | a different scheme | vague | tight | the company's culture works against you |
| Very hard | **two fraudsters, two different schemes** — accuse both | almost none | tight | several |

Every case in a contract is a fresh seed. The company's people are fixed by a per-company seed; only the
transactions are new.

**Budgets** = the cost of the intended tool(s) for the case's fraud(s), plus spare coins: 4 (easy), 3
(medium), 2 (hard and very hard). Never enough for every tool.

**Ledger sizes** were settled by testing (9.1): 1,000 rows is the smallest ledger where Z-Score reliably
catches a huge invoice, so the ladder runs 1,000 → 1,500 → 2,500 → 3,500 → 5,000. Schemes that add rows (weekend
spending, the ghost vendor) grow with the ledger so they stay findable.

---

## 3. Rating a Contract

### 3.1 Case rating (0–100)

To accuse in Career you build a case, not just pick a name: the **suspect**, the **theory** (which of the
six tricks they used), **1–2 clues** from your tools, and **1–5 exhibit rows** from their ledger.

| Part | Points | Measures |
|---|---|---|
| Verdict | 35 | you accused the right person |
| Theory | 10 | you named the trick they really used |
| Proof | 10 | **proven** (10): a clue from a tool that *fits* your theory names them alone, or two different tools do; **lead** (4): a clue points at them but proves nothing; **none** (0) |
| Exhibits | 25 | 25 × (share of your pinned rows that show the trick) × (rows that show it ÷ rows needed, capped at 1). Three rows are needed, fewer when the fraud left fewer |
| Spending | 20 | 20 × (coins the intended tools cost + a free cross-check ÷ coins spent, capped at 1), counted only for accusations a clue points at |

- **What fits a theory** (`career/proof.py`): one monster invoice → Box & Whisker; billed twice →
  Duplicates; made-up receipts → Benford or Isolation Forest; weekend payments → Time Series or Pattern
  Matrix by weekday; costs too big for the deal → Regression; just under the approval limit → Pattern Matrix
  by vendor or Isolation Forest. A tool fits when, in the calibration runs, it named the fraudster alone in at
  least nine cases in ten. Z-Score fits nothing: it says where to look, not who did it.
- **Fair exhibits:** a fraud row, or a row that is part of the evidence, such as the honest original of a bill
  billed twice. Every honest row you pin lowers the score.
- **The free cross-check:** 2 coins at small and mid firms, 1 at large, none above. Large hard cases leave one
  spare coin instead of the usual two, so a wrong guess puts the right tool out of reach.
- **No analysis, no thrift:** an accusation no clue points at earns no Spending points, so a lucky guess can't
  be Exceptional.
- **Two fraudsters (very hard cases):** every part is shared between them; you accuse both, each with their own
  theory, clues and rows.
- **No TRY AGAIN in Career.** A wrong verdict scores what it scores and the contract moves on to the next
  case; the 5-case average is the second chance. (Quick Case keeps TRY AGAIN for practice.)
- **Points after every case:** the verdict screen shows the five parts, each with a one-line reason, plus the
  running contract average and the band it sits in.
- **Case Summary runs automatically and free** when a case opens, so every player starts with an overview.

The in-case score (1000 + evidence + 40 per coin) stays as it is; the rating is a separate number used only
for the career, in its own module (`career/rating.py`), so Quick Case and Class Mode never touch it.

### 3.2 Contract rating

Contract rating = the average of the 5 case ratings (3 for the Final).

| Result | Rating |
|---|---|
| **Exceptional** | at or above the tier's bar (**88** small and mid · **92** large · **90** very large), **and the hard case solved** |
| **Good** | 70 up to the bar |
| **OK** | 60–69, **or any contract where every suspect was right** |
| **Bad** | below 60 (only possible with at least one wrong accusation) |

Every case counts equally in the average. The contract screen says from the start: *"Exceptional requires
solving the hard case."* The bars were set with bots (§10).

Consequences: one wrong accusation nearly always rules out Exceptional; you can only be fired for wrong
accusations, never for a slow or messy investigation.

---

## 4. Offers, Promotion and Firing

**Start:** all three small companies make you an offer. Pick one.

| From → To | Requirement |
|---|---|
| Small → Mid | 1 **Good** contract. An **Exceptional** also brings 1 Large offer. |
| Mid → Large | 2 **Good** contracts at two different mid companies. An OK pauses the streak, it does not reset it. |
| Large → Very large | **Exceptional** at 2 of the 3 large companies; three **Good** years at one large company count as one Exceptional |
| Very large → The Final | **Exceptional** at both very large companies |

| Result | What happens |
|---|---|
| Exceptional / Good | progress toward the next tier (above); offers you already hold stay open (no limit, no expiry) |
| OK | offers unchanged |
| Bad | new offers from the next tier are withdrawn; you may stay and restart this company from the easy case, with fresh cases. The restart is a new, appraised year and counts toward firing. |
| 2 Bad in a row at one company | **fired**: back to the tier below, at that tier's base salary. At Small, you are only banned from that one firm. The Mid → Large streak resets to zero. |
**Replaying a finished company** is allowed as practice: the result is recorded but earns no hike and no
promotion credit.

### 4.1 The Final is played once

The Final is the end of the story, and it is played **exactly once** per career: all three cases, no retries.
The last case ends with a cutscene (7.5), and once it has played the story is over — the Final can never be
played again in that career. Whatever happened, the career moves on to **free play** (replay companies,
Adaptive Fraudster cases), where there is no Final.

**Only case 3 decides the ending.** Cases 1 and 2 are scored and shown as usual, but they don't change which
ending you get.

| Case 3 of the Final | Ending |
|---|---|
| You catch the cameo | the confession cutscene, then the good ending: **₹5 Cr** and the title **Chief Auditor** |
| You miss the cameo | the escape cutscene, then the bitter ending: your Very large salary stays; the Commission lets you go quietly |

A player who wants to play the Final again starts a new career (*Retire*): the same three cameos, a new
random culprit.

There is always somewhere to work: a player can never be locked out of every company.

---

## 5. Salary

Salary is **status only** for now: shown on the profile, the Detective Card and the appraisal screen. It
cannot be spent.

| Tier | Base | OK | Good | Exceptional | Ceiling |
|---|---|---|---|---|---|
| Small | ₹6 LPA | +20% | +50% | +100% | ₹15 LPA |
| Mid | ₹15 LPA | +10% | +25% | +50% | ₹40 LPA |
| Large | ₹40 LPA | +10% | +20% | +30% | ₹1.5 Cr |
| Very large | ₹1.5 Cr | +10% | +15% | +25% | ₹5 Cr |
| **The Final** | **₹5 Cr** | | | | |

- Bad = no hike.
- Salary in a tier cannot go above the next tier's base (the ceiling): to earn more, move up.
- Promotion pays whichever is higher: the new tier's base or your current salary.
- Fired = the lower tier's base.

A typical climb: ₹6 L → 9 L → **15 L** (Mid) → 18.75 L → 23.4 L → **40 L** (Large) → 52 L → 67.6 L →
**1.5 Cr** (Very large) → 1.875 Cr → 2.34 Cr → **5 Cr** (the Final).

---

## 6. The Prologue

Shown once, before the first offer desk. Four short typewriter panels, skippable, replayable from the Manual.

**1. The Bureau.**
*Mumbai. 2 AM. Monsoon.* The Bureau of Forensic Audit sits above a closed bank on Mint Road: three rooms, one
working fan, and a Chief who hasn't slept since 2009. Companies come here when they think someone inside is
stealing from them and they can't prove it. You are the new hire. Your desk was cleared this morning. Nobody
says what happened to the last one.

**2. How a case arrives.**
A company hands over its expense ledger: every claim, every invoice, every payment for ninety days. They give
us the names of the people who could have touched the money. One of them did. The ledger knows which one. Your
job is to make it say so.

**3. Reading a ledger.**
Three real rows from your first company's ledger, each column labelled: date, hour, employee, vendor,
category, amount, the deal it served. "Every row is a decision someone made. Most of them are honest. Learn
what honest looks like first."

**4. The rule of the job.**
"You get a budget. Every tool costs coins and you can't run them all, so think before you spend. You get one
accusation per case, with two pieces of evidence. And remember this: *an outlier is a question, not an
answer.* Big isn't crooked. Strange isn't guilty. Prove it."
Three envelopes slide across the desk: the first offer letters.

---

## 7. The Companies

Each company has a **culture**: the way honest money moves there. The culture changes the honest data (category
mix, timing, vendors), so the same tool behaves differently from one company to the next, and sometimes the
culture is the red herring.

### 7.1 Small (5 suspects per case, 1,000 rows)

**Lakshmi Sweets & Caterers** · Dadar, Mumbai · family sweet shop and caterer, ~25 staff
- *The letter:* Mrs. Lakshmi Iyer has run the shop since her husband died. Diwali orders keep the business
  alive, and this year the cash box doesn't match the order book. She doesn't trust banks, and she trusts
  accountants less. Her nephew found your card.
- *Culture:* daily supplier payments (milk, sugar, ghee), small amounts, very regular.
- *Signature fraud:* one supplier invoice far too large for its kind → **Z-Score / Box & Whisker**
- *Key staff:* Venkat Iyer (Head Cook), Pooja Shetty (Counter & Accounts), Manoj Gawde (Delivery Supervisor)

**Konkan Coast Travels** · Ratnagiri · bus and tour operator, ~40 staff
- *The letter:* Sameer Patil runs buses between Mumbai and Goa. Fuel bills are up and bookings aren't. His
  drivers claim fuel on the road, mostly with handwritten receipts.
- *Culture:* fuel, tolls and repairs; weekend and night travel are normal.
- *Signature fraud:* the same fuel bill claimed twice under fresh bill numbers → **Twin Finder**
- *Key staff:* Dinesh Sawant (Senior Driver), Rekha Naik (Booking Office), Anil Chavan (Workshop Foreman)

**Pixel Garage Studios** · Bandra, Mumbai · indie game and design studio, ~15 staff
- *The letter:* Two young founders, Zoya Merchant and Neil Fernandes, just got their first investor. The
  investor wants a clean audit before the money lands. The founders say everything is fine. They are very
  nervous.
- *Culture:* software subscriptions, hardware, late-night food orders. Late hours are normal here.
- *Signature fraud:* a "freelancer" vendor nobody has met, paid regularly by one person → **Pattern Matrix**
- *Key staff:* Neil Fernandes (Co-founder, Tech), Aisha Khan (Art Lead), Rahul Bhatt (Office & Finance)

### 7.2 Mid (5 suspects per case, 1,500 rows)

**Sterling Mercantile Pvt. Ltd.** · Fort, Mumbai · old trading house, ~200 staff
- *The letter:* A hundred-year-old firm that still closes on Saturdays and Sundays. The new MD found company
  card charges on days the office was locked.
- *Culture:* strict Monday–Friday; the Diwali bonus week is a large honest spike.
- *Signature fraud:* personal weekend spending → **Timeline** · *herring:* Diwali bonuses

**Bluewave Pharma Distributors** · Navi Mumbai · medicine distributor, ~350 staff
- *The letter:* Field reps file hundreds of claims a month. Every claim is the right size and on time. The
  CFO says the numbers look "too tidy" and can't say why.
- *Culture:* many reps, many small travel and meal claims.
- *Signature fraud:* invented amounts → **Benford's Law**

**Horizon Realty Developers** · Pune · real estate developer, ~300 staff
- *The letter:* Bigger projects cost more to sell, and that's fine. But one team's costs have stopped
  following their projects.
- *Culture:* expenses scale with deal value; the Chairman spends big on everything.
- *Signature fraud:* padded expenses → **Margin Model** · *herring:* the Chairman (CEO)

**Malabar Textiles International** · Kochi · textile exporter, ~400 staff
- *The letter:* An export house with a famous, flamboyant owner. The board wants an audit before an IPO, and
  everyone assumes the problem is the owner.
- *Culture:* large buyer-entertainment and travel bills; the owner's spending is honest but huge.
- *Signature fraud:* one claim far too large for its kind → **Z-Score / Box** · *herrings:* the owner (CEO),
  Diwali bonuses. The lesson: big isn't crooked.

**Saffron Media Networks** · Andheri, Mumbai · TV and digital media, ~250 staff
- *The letter:* Shoots, events, late nights, weekends. Payments go out at all hours, so nobody noticed one
  vendor that only gets paid at night.
- *Culture:* weekend events and night shoots are normal — the Timeline lights up for honest people.
- *Signature fraud:* night payments to an unknown vendor → **Pattern Matrix** · *herring:* the weekend culture

### 7.3 Large (5 suspects per case, 2,500 rows)

**Arabian Sea Shipping Co.** · Mumbai Port · shipping line, ~2,000 staff
- *The letter:* Ships sail every day of the week, so weekend payments are normal. Somewhere in two and a
  half thousand payments is a vendor that doesn't exist.
- *Signature fraud:* ghost vendor → **Anomaly Hunter**. (The culture is weekend payments, not night ones:
  even 2% honest night payments hide a ghost vendor from the Isolation Forest — see 9.1.)

**Indus Steel & Infrastructure** · Nagpur · steel and construction, ~3,500 staff
- *The letter:* Five departments, five budgets, one board that wants to know why project costs keep slipping.
- *Signature fraud:* padded expenses hidden inside one department → **Margin Model**. With this many rows,
  Z-Score raises false alarms on honest people.

**Meridian Hospitals Group** · Bengaluru · hospital chain, ~4,000 staff
- *The letter:* Hospitals never close. Supply claims come in every hour of every day, and one supplier's
  numbers feel made up.
- *Signature fraud:* invented amounts → **Benford's Law** · *herring:* 24×7 operations (weekend spending is
  normal)

### 7.4 Very large (7 suspects per case, 3,500 rows)

**Vasundhara Industries Group** · Mumbai · conglomerate (chemicals, retail, power), ~20,000 staff
- *The letter:* Three divisions that barely talk to each other, and a chairman who wants one answer before
  the annual meeting. The very hard case has two fraudsters in two divisions using two different schemes.

**Deccan Crown Bank** · Hyderabad · private bank, ~15,000 staff
- *The letter:* A bank audit, where every rupee is someone else's money. Regulators are watching. The
  very hard case has two fraudsters working separately, each hiding from a different tool.

### 7.5 The Final (10 suspects per case, 5,000 rows)

**The Kaveri Inquiry** · National Financial Integrity Commission, New Delhi
- *The letter:* The Commission has been watching one name move from company to company for years, never
  caught. They've been watching you too. The fraudster has studied every case you've solved and hides from the
  tools you rely on most (the Adaptive Fraudster, driven by your career's tool history).
- Three very hard cases, played once (4.1).
- **The twist:** all three of your old colleagues are here, and they greet you as always. In the **last case
  of the Final**, one of the two fraudsters is one of them — **picked at random per career**, so friends
  comparing notes can't spoil it. A familiar face who sat in your lineups for years, always innocent. A player
  who learned "the people who greet me are never guilty" and stopped checking them gets it wrong.
- **If you miss them — the escape cutscene.** The verdict comes back wrong, and a cutscene plays: the cameo
  leaving the building with a bag, while their story replays company by company, built from this career's
  real history — every company you met them at, what they said in each greeting, every lineup they stood in
  while you looked at someone else. Closing line: *"They were with you from the start. You never once checked
  their numbers."* The story ends there (4.1).
- **If you catch them — the confession cutscene.** The same history, told by them this time: how they
  followed you from your first company and learned how you work. Then the ending.

---

### 7.6 Characters

- **Staff:** every company has a fixed roster of **20 people of its own** — 14 × 20 = 280 people in the
  game. Small companies' key staff are written above; the rest are generated from a fixed per-company seed
  (name from first-name and surname pools, generated portrait, role, department, and a spending habit drawn
  from the company's culture). Mid key staff are hand-written as each mid company is built. Each case draws
  its suspects from the roster.
- **Cameos: three fixed characters who follow your career.** The same three in every career. The game lets
  you learn that they're safe — then the Final breaks that rule. The lesson: don't let what you believe
  override the data.
  - **Meeting them:** all three work at your **first small company** (whichever you choose), added to its
    roster (20 + 3).
  - **After that:** every new company has **1 cameo (60% chance) or 2 (40%)**, added to its roster.
  - **Who comes:** picked at random, but each time a cameo appears their weight **halves**, so all three
    rotate without a fixed order (start: ⅓ each; after person 1 appears once: ~20% / 40% / 40%).
  - **The greeting:** on your first day each cameo greets you and names **only the last company you worked at
    together** ("Last time was Konkan Coast Travels, remember? Those handwritten fuel bills!"). The game
    stores, per cameo, that last shared company and updates it each time they appear. At your first company
    there is no shared past yet: they're the friendly colleagues who show you around.
  - **Never guilty before the Final** (including their first company). The fraudster pick skips them, as it
    skips the CEO. Attentive players will start ruling them out.
  - **The Final: all three are there, and one of them is guilty.** See the twist in 7.5.
  - **How often** they're among the suspects: ~54% of cases at your first company (3 of 23); at Mid and Large
    ~24% with 1 cameo, ~42% with 2; at Very large ~33% with 1, ~55% with 2.
  - **The three** (`career/catalog.py`): **Imran Sheikh**, who knows everyone's name and is always first to
    say hello; **Tara Pinto**, dry wit and a sharp pencil, who reads contracts for fun; **Meher Contractor**,
    calm and kind, who always has a spare charger. Each has a first-day line, a greeting that names your last
    shared company, a confession for the Final and an escape line for the bitter ending.
- **Story names are reserved.** The suspect generator excludes every surname used by a story character
  (the Chief, company owners, written staff). This fixes the R. Desai / Rohan Desai clash for good.
- The company list above is a working map: only the first-version companies are final.

### 7.7 Seniors

On day one at every company except the Final, a senior hands you their notes (`career/seniors.py`). Seniors
are never suspects. Their notes are about the company (how honest money moves there, what fooled the last
auditor), never about the case, and their numbers come from the calibration runs. The notes fade as you
climb: a full page at small firms, a few lines at mid, one line at very large, nobody in the Final ("you're
the senior now"). Small and mid firms also show the tool kit with what each tool can prove, and small firms
spell out the proof rule: *name the trick, attach the clue that shows it, then pin the rows that prove it.*

---

## 8. Screens

- **Title menu:** QUICK CASE · CAREER · CLASS MODE · MANUAL, with Options behind a gear icon. The stable
  mode stays on top, so turning the career flag off doesn't move what the presenter rehearsed.
- **Career hub:** offers, the current contract, appraisals, tier, company, salary and history.
- **Case verdict (Career):** after every case, the 0–100 rating with its five parts and the reason for each,
  the contract so far (e.g. "Case 3 of 5 · average 84 · Good"), and a NEXT CASE button. No TRY AGAIN.
- **Detective Card:** gains only the career **title** (e.g. Chief Auditor). Company and salary live on the
  Career hub, so the card never shows empty fields in Quick Case or Class Mode.

---

## 9. Build Plan

- **Built:** all fourteen companies, the prologue, offers, appraisals, promotion and firing, salary, the
  three cameos, two-fraudster cases, the Final and both endings, free play.
- **Behind a feature flag.** Career scoring lives in its own module; Quick Case and Class Mode keep the
  current scoring code. Run the Quick Case and Class Mode regression tests before every merge.
- **The team sets the freeze date** against the course schedule.
- After the viva: consider adding the Adaptive Fraudster to Quick Case.

---

## 9.1 Implementation Notes

- **Code:** `game/backend/auditor/career/` — `catalog.py` (tiers, salaries, companies, cameos), `people.py`
  (rosters), `cases.py` (contract plans and case building), `proof.py` (what proves a theory), `rating.py`
  (0–100 and bands), `seniors.py` (day-one notes), `rules.py` (the
  career state machine), `storage.py` (the `careers` table, next to telemetry), `routes.py` (`/api/career`).
  Frontend: `game/web/components/career/`, `game/web/components/verdict/CareerVerdictScreen.tsx`, `/career`.
- **Feature flag:** `NEXT_PUBLIC_CAREER=0` hides Career Mode from the menu; `AUDITOR_CAREER=0` turns off its
  routes. Quick Case and Class Mode never call career code.
- **Fairness tests** (`tests/test_career_fairness.py`, slow): at every company, over 20 contracts, at least one
  catching tool finds each fraudster (95% overall, 85% per fraud), and honest companies stay quiet. Z-Score is
  allowed some false alarms on honest ledgers (up to 7 in 20, more often in big ledgers) — the lesson that an
  outlier is a question, not an answer. The boss (the CEO herring) is excluded: looking guilty is their job.
- **Debug jump:** with `AUDITOR_DEBUG=1`, `POST /api/career/{code}/debug-jump` sets a career's offers and tier
  — for tests and for a presenter demoing late-game screens.

---

## 10. Calibration

Bots play every tier (`game/backend/scripts/calibrate_career.py`). A sharp bot (reads the senior's notes, runs
the fitting tool, pins the rows it flags) reaches Exceptional **100%** of the time at small firms, **87%** at
mid, **40%** at large and **about 20%** at very large. The bar barely matters: solving the hard case decides
it, which is why large hard cases now leave one spare coin instead of two (it was 70%).

Very large stays at about 20%, below the 30–40% first aimed for, on purpose: its hard case has two
fraudsters, and it is the last step before the Final. Salary is status only.
