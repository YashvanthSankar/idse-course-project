# Jeeva: pipeline work still to do

The pipeline project is **TAREEKH: how long do Indian district-court cases take?** Read
[`IDEA.md`](IDEA.md) (why, and the rules) and [`pipeline/README.md`](pipeline/README.md)
(how to run, what's built, everything measured so far) first.

This list is kept up to date as work lands. Tick items off in your commits.

## 1. Data (in progress)
- [ ] Finish downloading `csv/cases/cases.tar.gz`
  (`uv run python scripts/fetch_ddl.py --want 'license.txt' --want 'csv/keys/*' --want 'csv/cases/*' --max-saves 3`).
- [ ] Find the acts/sections file for each case (not in the yearly case files) and join it on `ddl_case_id`.
