# Optional: a speedrun leaderboard for Career Mode

This feature is not built. The career name field already exists, so the board can show players'
names.

## The idea

Career Mode works as a speedrun. A player can only reach the large, very large and Final
companies by earning Exceptional contracts, so they can't get there by guessing. The board
therefore ranks players by **speed**; the rules of the game take care of **skill**.

- **Who gets on the board:** only careers that reach the Final and end in **"caught"**. A career
  that lets the final culprit escape doesn't count.
- **Ranking:** least total time spent inside cases first. Each row shows the player's name, their
  time and the number of contracts.
- **Size:** the top 20, plus the player's own row highlighted with "YOU" if they're further down.
- **Career codes are never shown.** Anyone who has a code can resume that career.

## How to build it

### Backend

1. **Start the clock.** Add `started: float | None` and `seconds: float | None` to `CaseRecord` in
   `backend/auditor/career/rules.py`. In `open_case` (`backend/auditor/career/routes.py`), set
   `record.started = time.time()` only when `record.case_id` is still `None`. A rebuilt case then
   keeps its first start time, and reopening a case doesn't reset the clock.
   - Use the wall clock, not `started_at` on the session. Career sessions are created with
     `started_at=0`, and the session is lost when the server restarts.
2. **Add up the time.** Add `case_seconds: float = 0.0` and `timed: bool = False` to `Career`.
   `new_career` sets `timed=True`. In the career `accuse` route, add `now - record.started` to
   `career.case_seconds` before calling `record_case`. If `started` is missing (the case was
   opened before the clock existed), set `timed = False`.
3. **Keep shortcuts off the board.** `debug-jump` sets `timed = False`.
4. **Show the time on the career.** Add `case_seconds` and `timed` to `CareerView`.
5. **Serve the board.** Add `GET /api/career/leaderboard?code=…`, declared **before**
   `GET /{code}` so the two routes don't clash. It returns `rank, name, seconds, contracts, year,
   you`, sorted by `(case_seconds, created)`.
6. **Find the finished careers.** For a class-sized game, `CareerStore` can select rows whose
   state contains `"ending":"caught"` and also check the in-memory cache for saves that haven't
   reached the database yet. At scale, use a separate `leaderboard` table, or cache the sorted
   board for about 30 seconds.

### Frontend

1. Run `pnpm gen:api` after the backend changes.
2. Add `getLeaderboard(code)` to `web/lib/api.ts`, and a `formatDuration` helper (`42s`,
   `7m 05s`, `2h 03m`) to `web/lib/career.ts`.
3. Add a "Case clock" next to the salary on the career hub (shown only when `view.timed` is true).
4. Add a "The speedrun board" section above "Your career so far". Its caption should say that the
   clock runs from opening a case to accusing.

### Tests

- Fake the clock with `monkeypatch.setattr(routes, "time", SimpleNamespace(time=…))`. Check that
  reopening a case doesn't restart the clock and that the total adds up across cases.
- Check that only "caught" careers appear, that untimed and debug-jumped careers are left out, and
  that the "YOU" row is marked.

## Points to settle

- **Idle time counts.** A tab left open overnight adds the whole night. To avoid that, pause the
  clock when the tab is hidden (`visibilitychange`) and add up time between heartbeats.
- **Wrong accusations** could be shown next to each time, as extra information.
- **Renaming:** add `POST /api/career/{code}/name` so players can change their name.
- **Old careers** (started before the clock existed) stay off the board, or appear with an
  "untimed" tag.
