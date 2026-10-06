# Splink service

`services/splink/` is a small Python program that picks pairs of records
worth checking, with [Splink](https://moj-analytical-services.github.io/splink/)
on DuckDB (docs/PairSight-Scale-Roadmap.md, item 5). The run worker runs it
for each saved dataset; the Plan adds the pairs it picked to the ones the
rules pick.

## The boundary

- **Records in, scored pairs out, as files.** TypeScript writes the records
  cleaned by our own blocking code (`src/server/pairsight/splink/records.ts`)
  and runs `python -m pairsight_splink score`; the service writes
  `a,b,match_weight,match_probability` and one line of JSON saying how it
  went. TypeScript stores the pairs in `pair_scores`. Logs go to stderr as
  JSON lines, which the worker passes to the app's logger.
- **Python never touches the database, never calls Jev, never sees runs or
  vendors.** Postgres stays the single source of truth.
- **The UI never names it.** On screen these are pairs "suggested by
  PairSight", explained in plain words from their reason codes
  (`pairsight_splink/reasons.py`, stored on `pair_scores.reasons`); see
  `docs/rules/copy.md`.
- **It only picks pairs.** Splink never decides a match: Jev judges every
  pair, and every vendor pair is always checked.
- **One place starts it:** `src/server/pairsight/splink/service.ts`, with
  `execFile` (no shell) and fixed arguments. ESLint bans `node:child_process`
  everywhere else in `src/`.
- **It never blocks anything.** A dataset it can't score (too few records, a
  type it doesn't do yet, not set up, or it failed) is planned with rules and
  vendor pairs, and the Plan says so in one line.

## Versions and changes

- Python 3.13; `splink` and `duckdb` are pinned in `requirements.txt`. An
  upgrade changes which pairs get picked, so it's deliberate: run the
  benchmark first (`scripts/splink-spike/`, on 10K and 100K generated
  people) and record the result in the roadmap.
- The same goes for the model (`pairsight_splink/model.py`: comparisons,
  the wide net, the training groups) and the floors (`STORE_FLOOR` in the
  service, `SPLINK_PLAN_FLOOR` in `splink/picks.ts`).

## Checks

- `pnpm splink:setup` makes `services/splink/.venv` with the pinned
  requirements and the dev tools; the worker finds it by itself.
- `pnpm python:check` runs ruff (lint and format) and pytest. It's a gate in
  CI (the `python` job) and in `local-review`, and `check:standards`
  requires it whenever a `pyproject.toml` is tracked.
- Python code follows ruff's rules as configured in `pyproject.toml`:
  snake_case, typed function signatures, no print except the CLI's summary.

## Settings

`SPLINK_PYTHON` (which Python runs it; unset means the local venv, and with
neither Splink is off), `SPLINK_MEMORY_LIMIT` (DuckDB's cap; it spills to
disk past it) and `SPLINK_TIMEOUT_MS`. On-prem, `services/splink/Dockerfile`
builds the service; point `SPLINK_PYTHON` at a wrapper that runs the image
with the job's temp folder mounted. Memory: about 0.4 GB at 10K records (the
app's limit), about 5 GB at 100K.
