# Splink service

`services/splink/` is a small Python program that picks pairs of records
worth checking, with [Splink](https://moj-analytical-services.github.io/splink/)
on DuckDB (docs/PairSight-Scale-Roadmap.md, items 5, 10 and 11). It has one
model per type of record (`pairsight_splink/person.py`, `company.py`,
`product.py`) and runs the one a dataset is for. The run worker runs it for
each saved dataset. Every plan is the pairs it picked (match weight 0 or
above, at most 100K) plus every pair any vendor matched; there are no other
rules.

## The boundary

- **Records in, scored pairs out, as files.** TypeScript writes the records
  cleaned by our own key code (`src/server/pairsight/match-keys.ts`, via
  `src/server/pairsight/splink/records.ts`)
  and runs `python -m pairsight_splink score --entity-type <type>`; the
  service writes
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
- **Every plan depends on it.** Start waits while it works out the pairs
  (`still_suggesting`). When it can't score a dataset (it failed, or it isn't
  set up) the Plan says so and offers **Try again**, which queues the
  scoring again (`suggestions_failed`); there is no fallback. Files under
  200 records are refused at upload, since it can't learn from fewer.
- **Both sides list the same columns.** Each type's `COLUMNS` in Python
  matches its keys in `splink/records.ts`; a unit test
  (`records.test.mts`) reads the Python file to keep them in step.

## Versions and changes

- Python 3.13; `splink` and `duckdb` are pinned in `requirements.txt`. An
  upgrade changes which pairs get picked, so it's deliberate: run the
  benchmark first (`scripts/splink-spike/`, on 2K, 10K and 100K generated
  records of each type) and record the result in the roadmap.
- The same goes for a model (each type's comparisons, wide net, training
  groups and held weights; `M_FLOOR` in `model.py`) and the floors
  (`STORE_FLOOR` in the service, `SPLINK_PLAN_FLOOR` in `splink/floor.ts`).
- And for how keys are made (`match-keys.ts`, `normalize.ts`, the profile in
  `src/server/pairsight/profile/`): run the benchmark clean and with
  `--defects`, since a stand-in or a date only shows on a messy file.
- **What a model may learn and what it holds.** Training is unsupervised,
  so a field it never sees disagree in its training groups can come out as
  either worthless or a veto. Fields where a difference means a different
  thing (a company number, a product's barcode, size or colour) hold their
  weights (`spec.held_exact`); every learned level keeps at least `M_FLOOR`
  of real duplicates, so no single difference outweighs everything else.
- **What it does when training has little to go on.** A training pass with
  no pairs is skipped up front (Splink would otherwise drop those fields),
  and when nothing anchors the estimate of how many pairs are duplicates it
  assumes about 5% of records have one.

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
app's limit) for every type; at 100K about 5 GB for people, 1.9 GB for
organisations and 2.4 GB for products.
