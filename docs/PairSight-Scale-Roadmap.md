# PairSight: scaling and smarter pair selection

The agreed direction after v1 (PRs #3–#10), from the design discussions of
2026-10-05. Each item below is **planned, built and tested on its own**, in
this order. Each plan starts from the code as the previous item left it, so
it builds on how things actually work, not on this document's guesses.
Update this file when an item ships or a decision changes.

## Why

v1 capped an evaluation at **500 records and 5,000 pairs per run** (now
10,000 records and 100,000 pairs: items 3 and 8). These were
safety limits from how v1 runs, not limits of Jev or the database:

- **Runs are driven by the browser tab.** There's no background worker. The
  page asks the server to check the next 10 pairs, so a run only moves while
  PairSight is open (`src/components/pairsight/runs/runs-centre.tsx`,
  `RunDriver`).
- **Jev's throughput.** About 0.3–0.45 s per call, 4 calls at once
  (`run-engine.ts`: `CONCURRENCY = 4`), so about 10 pairs a second. The real
  rate limit is unknown. Cost is not the issue: about $0.00002 a pair at the
  stand-in rate, so a million pairs is about $20.
- **Everything loads into memory per request.**
  - Uploads: a 2 MB server-action limit, the whole file parsed at once, every
    record inserted in one go.
  - Results, Overview, downloads and the PDF: each load the whole run (every
    pair and record) into the Node process and count in JavaScript. The
    computing is already on the server; the problem is that it isn't in the
    database.
- **Comparing everything with everything stops scaling.** 500 records is
  125k possible pairs; 10k is 50M; 100k is 5B.

**Target:** 10,000 records first, designed so the same architecture reaches
100k and 1M+ without another rethink.

|                                    | Today   | 10,000 records | 100,000 records |
| ---------------------------------- | ------- | -------------- | --------------- |
| Possible pairs                     | 125k    | 50M            | 5B              |
| Pairs from rules (1–10 per record) | ≤ 5,000 | ~10k–100k      | ~100k–1M        |
| Vendor-matched pairs               | small   | ~1k–10k        | ~10k–100k       |
| Jev time at ~10/s                  | ~8 min  | 20 min – 3 h   | 3 – 28 h        |
| Jev cost (stand-in rate)           | ~$0.10  | ~$0.20 – $2    | ~$2 – $20       |

## Decisions so far

- **Keep Next.js for the web app.** It came from the 8x template, not a
  PairSight choice. It suits sign-in, uploads, settings, pages and downloads.
  It doesn't suit long-running jobs or heavy number-crunching, so those move
  to a worker. No other web stack is needed.
- **Add a background worker, in TypeScript.**
  - Runs continue with the browser closed.
  - TypeScript because:
    - every Jev call must go through `src/server/ai/` + `trackAiCall`
      (`docs/rules/ai-usage.md`, an ESLint-enforced, cross-repo cost
      contract that only exists in TypeScript);
    - the run engine (Jev requests per record type, judgment reuse, retries,
      run states, the e2e Jev stub) already exists and is tested in
      TypeScript;
    - the database schema has one definition, in Prisma.
  - It shares the repo, the Prisma models and the matching code.
- **Use Splink for candidate pairs and scoring**: Python, on **DuckDB**.
  - Splink is the Fellegi–Sunter model with EM training. It needs no
    labels, does term-frequency adjustment, has graded comparisons
    (Jaro-Winkler, Levenshtein, Double Metaphone…) and explains every
    score per field. The same code scales from DuckDB to Spark.
  - Building this in TypeScript means re-deriving subtle statistics. The
    worst trap: a field used to block can't be estimated from those blocked
    pairs. Mistakes there don't crash anything; they make results quietly
    wrong.
  - **Why DuckDB rather than Postgres:** Splink's work is a few huge
    analytical joins and aggregations. DuckDB is columnar, multi-core and
    has the similarity functions built in. Running this on the app's
    Postgres would be slower and would slow the app. DuckDB is a library
    inside the Python process (like SQLite), not another server.
    **Postgres stays the single source of truth.**
  - **The service boundary is narrow:** records in, scored pairs (and the
    model's per-field explanation) out. Python never calls Jev, never
    touches runs, and writes nothing but the scored pairs. TypeScript owns
    everything else.
  - Not dedupe or Zingg: they need people to label example pairs, which
    is friction. Not fastLink: R is harder to package and scale.
- **Jev is the only judge.**
  - Splink decides _which pairs are worth checking_, never _whether a pair
    is a duplicate_. Splink is itself a matcher, like the vendors (some may
    use the same method), and it can't read the user's "what counts as the
    same" (relatives, subsidiaries).
  - **Every vendor-matched pair is always checked by Jev**: that's what
    vendors are graded on.
- **Reduce pairs by being smarter, not by sampling the answers.**
  - The funnel: a wide net (high recall), then weigh what each pair shares
    (meta-blocking), then Splink's score, then a low floor.
  - Jev checks a small safety sample below the floor, so the report can
    say how many duplicates might have been left out.
- **Results become database queries.** Paging, filters, counts and
  aggregates are done in Postgres and exposed as small server queries; the
  web server only handles the rows on screen and the totals.
- **Copy:** everything new follows `docs/rules/copy.md` (plain,
  conversational; "vendor" stays).

## The items, in build order

Each item gets its own plan, build, local review, e2e and PR. Dependencies
are noted; the later items assume the earlier ones exist.

### 0. Measure first (done, 2026-10-05)

- **Jev speed test (`pnpm jev:speed`, live, about 3 cents in all):**

  | Calls at once | Calls | Rate-limited or overloaded | Pairs/s | p50 latency |
  | ------------- | ----- | -------------------------- | ------- | ----------- |
  | 4             | 40    | 0                          | 9.8     | 335 ms      |
  | 10            | 50    | 0                          | 25.4    | 341 ms      |
  | 20            | 100   | 0                          | 48.4    | 339 ms      |
  | 40            | 200   | 0                          | 97.3    | 336 ms      |
  | 80            | 400   | 0                          | 162.2   | 345 ms      |
  | 120           | 600   | 0                          | 277.1   | 344 ms      |

  Throughput scales almost linearly, latency stays flat, and there were no
  429s or 529s even at 120 at once. **Jev is not the bottleneck; today's
  engine (4 at once, driven by the browser) is.** The ceiling hasn't been
  found yet.

- **10,000 synthetic people (`pnpm scale:measure`, no Jev, no database):**
  989 planted duplicates, 40% of them hard (a typo, a new email provider,
  swapped names, a nickname after a move).
  - **The file is 1.00 MB:** exactly today's upload limit (2 MB server-action
    limit). 100k would be about 10 MB. Item 3 is needed.
  - **Reading took 15 ms; blocking 0.4 s; the heap stayed under 100 MB.**
    Computing isn't the problem at 10k.
  - **Default rules:** 1,188 pairs, 70.6% of planted duplicates.
  - **Default + close-match presets:** 12,888 pairs (over the 5,000 cap), but
    only 76.5%. `surname_sound_birth_year` alone makes 11,760 pairs, because
    common surnames ("Smith" sounds) share birth years at this size. It
    catches about 60 more duplicates for 11,000 more pairs. On the 104-person
    file the same preset was the star (37% → 85%).
  - **The lesson for items 5–6:** hand-picked keys that work on small files
    get noisy at scale. That's the case for weighing what pairs share (term
    frequency: sharing "Smith" means little) rather than adding rules.
  - **Jev time** for the 12,888 pairs: 21 minutes today, about 2 minutes at
    40 at once, under a minute at 120.
  - Caveat: the generator's phone numbers are random within a small range,
    so the phone rule picks up some chance collisions (781 pairs).

### 1. Background worker (done, 2026-10-05)

- **Built:**
  - A run worker inside the web server, started at boot from
    `instrumentation.ts`. In the web server rather than its own process
    because almost every server module is `server-only`.
  - No queue library: a running run is the job, pairs are claimed with a
    compare-and-set (`run-engine.ts`), and stale claims are reclaimed after
    60 s.
  - `RUN_WORKER_CONCURRENCY` (default 40) is shared across running runs; `0`
    turns the worker off.
  - The Runs centre watches instead of drives, and sees runs started
    elsewhere.
  - Pause and Resume.
  - Indexes `runs(status)` and `assessments(status, claimedAt)`.
  - Fix: starting a run no longer re-queues other runs' failed pairs.
- **Measured:** a live run of 40 pairs at 40 at once finished in 2.4 s, every
  Jev call recorded and priced in `ai_usage`. The full e2e suite passes
  (44), including runs finishing with the tab closed, pause and resume, and a
  second tab noticing a run.
- **Left for later items:** the pair cap and the 500-record limit (items 3
  and 8); telling someone a run finished when no page is open (in-app only
  for now).

### 2. Results from the database (built, 2026-10-06)

- **Built:**
  - **The Overview is worked out once,** when the run finishes, and stored
    on the run (`runs.summary`, `run-summary.ts`): a count table (status ×
    0.01 score bin × Jev's decision and close call at the run's cut-off ×
    which vendors matched × why it was checked), pairs per rule, the field
    patterns per vendor over every judged pair, the top disagreements, the
    Jev versions and the record count. Every number on the Overview, the
    dashboard and the PDF comes from it **exactly**
    (`src/lib/pairsight/stats.ts`). That includes the 0.05 cut-off sweep
    and the threshold preview, which now receives a few hundred rows
    instead of one entry per pair. Nothing is sampled.
  - **Kept current:** a run that finishes, and a pair page's re-check,
    clear and rebuild the summaries of the other finished runs sharing those
    judgments. Runs finished before this build theirs on first read.
  - **Detailed analysis in SQL** (`results-query.ts`): the same filters,
    search and order, a page at a time with an exact count, plus the pair's
    position and neighbours for J/K.
  - **Bounded requests** (`docs/rules/database.md`, "Bounded queries"): a
    Results request reads `run_pairs` alone and joins records and judgments
    only for the rows it shows. Each pair's status, score, sort key and
    search text are copied onto it when the summary is built, so a summary
    and its pages always agree. The first version joined the whole run on
    every request, and at 1M pairs that ran the local database out of shared
    memory and crashed Results. `pnpm scale:check-results` now reads every
    request query's plan and fails on a whole-run read.
  - Records carry `label`, `sortKey` and `searchText`. `sortKey` is the
    natural-order key in hex, so the database's own collation and its index
    give natural order.
  - **Streaming downloads:** findings CSV and Excel are written a page at a
    time, walking records in natural order through their index. They're
    plain links, so the browser shows its own progress. Past 1,048,575 rows
    the menu offers CSV only.
  - Phone numbers are parsed once per value, not once per pair (a bounded
    memo in `normalize.ts`): that was most of the summary's time.
- **Proven equal:** `pnpm scale:check-results` compares the database's
  summary, every filtered list, its order and pair positions against the
  pair-by-pair code on every finished run in the local database: all 860
  match, including a 200,000-pair one. The full e2e suite passes, including
  a new test: a later run re-checking a shared pair updates an earlier
  finished run.
- **Measured** (`pnpm scale:seed-run`, `pnpm scale:measure-results`; local
  Docker Postgres on a laptop, default settings):

  |                                   | 200k pairs  | 1M pairs                    |
  | --------------------------------- | ----------- | --------------------------- |
  | Summary built (in the background) | 17 s        | 165 s                       |
  | Overview read                     | 17 ms       | 20 ms                       |
  | Detailed analysis, a page         | 0.004–0.3 s | 0.01–1.3 s                  |
  | Count of a filtered list          | 0.02–0.09 s | 0.07–0.11 s                 |
  | Search                            | 0.1 s       | 0.25 s                      |
  | Pair position (J/K)               | 0.1–0.55 s  | 0.14–1.6 s                  |
  | Findings CSV, every pair          | 8 s         | 44 s, memory flat (~400 MB) |

  Twelve Results requests at once on the 1M run finish together in 3.7 s.

- **Left open:** the summary build at 1M pairs (165 s) is background work
  but slower than the first version (94 s), as it now copies each pair's
  judgment. A rebuild only rewrites pairs whose judgment changed.

### 3. Large uploads (built, 2026-10-06)

- **Built:**
  - **Upload once.** A file goes up once, as the raw body of
    `PUT /api/evaluations/[id]/uploads`, with progress, and is kept in an
    `uploads` table while it's checked. Every preview, sheet pick and vendor
    column change reads it from there. Gone once saved, or after a day (the
    run worker sweeps). Server actions no longer carry files.
  - **Read as a stream.** CSV is parsed a batch of rows at a time. Excel
    uses ExcelJS's streaming reader, after the zip is reordered (copied, not
    unpacked) so the sheet list, number formats and shared text come before
    the sheets: ExcelJS-written and other workbooks keep them last, which the
    streaming reader can't handle. The checks run as rows go by, with the
    same row-numbered messages (`tabular/scan.ts`).
  - **Checked in one pass.** Every column is checked as a possible record ID
    in one pass, linear in the file's cells (it was columns × rows ×
    columns).
  - **Saved in batches.** Records go in 5,000 at a time on a second pass, and
    a dataset only becomes current once all its records are in
    (`source_datasets.savedAt`). A save that fails part-way leaves nothing.
    Vendor matches are confirmed in batches too, in one transaction.
  - **Limits:** 10,000 records, 10 MB files, vendor files up to 100,000
    rows.
  - The Rules screen reads the records once per request, not twice, and
    `blocking.ts` lost its quadratic spots.
  - A run's progress is stored on it (pairs checked, pairs failed) and kept
    as pairs are answered, so the Runs centre's every-second check no longer
    counts a run's pairs. A run's elapsed time stops when its last pair is
    checked, not when its results are ready.
- **Measured** (`pnpm scale:measure-uploads`, the same code the screens
  run; local Docker Postgres):

  |                               | 10K CSV        | 10K Excel      | 100K CSV (past the limit) |
  | ----------------------------- | -------------- | -------------- | ------------------------- |
  | Upload                        | 0.2 s (1.0 MB) | 0.1 s (0.7 MB) | 0.7 s (10 MB)             |
  | Preview, every column checked | 0.1 s          | 0.7 s          | 0.8 s                     |
  | Save                          | 2.8 s          | 3.8 s          | 15 s                      |
  | Rules page                    | 0.9 s          | 0.5 s          | 10.7 s                    |
  | Plan page                     | 0.3 s          | 0.2 s          | 3.5 s                     |

  A 10K vendor file is checked and confirmed in under 0.2 s each.

- **Left for later:** at 100K records the upload, check and save hold, but
  the Rules and Plan pages rebuild every pair on each view (10.7 s and
  3.5 s). Raising the record limit past 10K needs that work done once and
  stored (with items 6 and 8), not just a bigger number.

### 4. Jev throughput (built, 2026-10-06)

- **Measured live** (`pnpm jev:speed 40 80 120 160 200`, 2026-10-06, about
  $0.06 in all): no pushback at any level.

  | Calls at once | Pairs/s | Note                   |
  | ------------- | ------- | ---------------------- |
  | 40            | 25.1    | cold start (p95 3.4 s) |
  | 80            | 130.6   |                        |
  | 120           | 254.7   |                        |
  | 160           | 337.3   |                        |
  | 200           | 403.9   | p50 390 ms             |

- **Defaults from that:** start at 100 calls at once
  (`RUN_WORKER_CONCURRENCY`, was 40) and climb to at most 200
  (`RUN_WORKER_CONCURRENCY_MAX`, the highest level measured clean). A call
  times out after 20 s (`TYPESAFE_TIMEOUT_MS`).
- **Built:**
  - **Never failing on pushback.** Every Jev outcome is one of four kinds
    (`judgment.ts` `classifyFailure`):

    | Outcome                                                                                                                        | What happens                                                                           |
    | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
    | A score                                                                                                                        | saved                                                                                  |
    | Busy: 429, 408, 409, any 5xx (529 too), a status Jev doesn't document, timeout, dropped connection, a body cut off or not JSON | the pair waits and is tried again, as often as it takes; everything slows down         |
    | Key refused (401, 403)                                                                                                         | the pair waits; after about a minute of refusals the run stops for the key to be fixed |
    | Key missing                                                                                                                    | the run stops                                                                          |
    | Jev refused the pair (400, 413, 422)                                                                                           | failed                                                                                 |
    | An answer without a usable score                                                                                               | asked again straight away, up to 3 times, then failed                                  |

    A waiting pair is released at once (nothing sleeps holding a slot) with
    `assessments.nextTryAt`: 2 s, 4 s, 8 s… capped at 2 minutes, jittered,
    never sooner than Jev's `Retry-After`. Our own database failing while
    saving an answer leaves the pair claimed, to be taken again once the
    claim is stale. A run never finishes while pairs are waiting.

  - **Calls are topped up, never batched.** As answers come back, the
    worker starts more of the run's pairs (once a quarter of its share is
    free), so one slow or stuck call holds only its own slot. Before, a run
    went a batch at a time and waited for the batch's slowest call: one call
    that never answered froze the whole run for the 20 s timeout. A 435-pair
    run with one stuck call now checks the other 434 in about 2 s.
  - **Answers are counted together**, every 250 ms, instead of one update of
    the run's row per answer. At 100 calls at once those updates queued on
    the one row (21 ms each) and were the slowest part of a run. Finishing a
    run recounts it exactly.
  - **One shared limit per server** (`worker/jev-limiter.ts`), for every run
    and a pair page's re-check. It adds 4 calls after each clean window up
    to the max, halves on pushback (once per burst, floor 2), and after 10
    busy answers in a row, or a `Retry-After`, stops calling: 5 s, then
    twice as long each time up to 2 minutes, with one probe call deciding
    whether to carry on. An outage of any length is just a longer wait.
  - **The card says when it's waiting** (`runs.waitingSince`): "Waiting for
    Jev", with a note that it carries on by itself. Pause still works;
    Resume sends waiting pairs straight away.
  - **A time estimate on the Plan screen**, next to the cost: the speed of
    the last 5 finished live runs with at least 50 new checks, taken
    together (item 8 refined this)
    (`runs.newChecks` over checking time), or calls at once ÷ 0.5 s per call
    before there are any; plus 30%, rounded up ("takes about 3 minutes").
  - Fixes on the way: a re-check from the pair page, or a stop, no longer
    turns a finished run into a stopped one; a re-check while Jev is busy
    leaves the pair failed to try again, instead of stranding it.
  - The Jev stub learned Jev's bad days (`/busy`, `/outage`, `/hang`,
    `/garbage`, 403), and the e2e suite runs each one to a complete run
    with nothing failed.

### 5. Splink scoring service (built, 2026-10-07)

- **Spike first:**
  - Run Splink on the planted-duplicate file and the synthetic 10k/100k
    files. Measure duplicates caught, pairs produced and speed against
    today's yardstick (`pnpm blocking:check`: exact rules 37%, close-match
    presets 85%).
  - Ship only if it beats that with fewer pairs.
- **Spike result: it does, by a wide margin, on 10K and 100K.**
  - **Set-up** (`scripts/splink-spike/`, branch `spike/splink`):
    - Splink 4.0.17 on DuckDB 1.5.6, trained with **no labels**, as it would
      run on a customer's file.
    - Both sides read the same records, cleaned by our own blocking code.
    - Scored against the generator's answer key (`generatePeople`, seed 42;
      the same 10K file item 0 measured).
    - No Jev, no database.
  - **Splink's role:** a wide net (same surname sound and birth year; first
    name sound and postcode district; email username; phone; birth date;
    postcode), then Splink's score keeps the pairs worth checking.

  | Duplicates found (pairs to check)    | 104 hand-made | 10K            | 100K              |
  | ------------------------------------ | ------------- | -------------- | ----------------- |
  | Default rules                        | 10/27 (11)    | 70.6% (1,188)  | 70.3% (50,706)    |
  | Default + close-match presets        | 23/27 (24)    | 76.5% (12,888) | 76.9% (1,214,466) |
  | Splink, same pairs as the presets    | 22/27         | 91.2%          | 90.1%             |
  | Splink, as many as the presets found | 25 pairs      | 963 pairs      | 61,476 pairs      |
  | Splink at about 90%                  | n/a           | 1,117 pairs    | 62,715 pairs      |
  | Splink time, peak memory             | 1 s, 0.1 GB   | 6 s, 0.3 GB    | 23 s, 1.8 GB      |
  - **10K:** Splink finds 91% of duplicates with fewer pairs than even the
    default rules (1,117 against 1,188), where the presets find 76.5% with
    12,888.
  - **100K:** our presets pick 1.2M pairs, over 12× the new 100K limit
    (item 8), for 76.9%. Splink finds 90% with 62,715 pairs, inside it.
  - **Where the gain is:** names swapped (presets 3 of 922 at 100K, Splink 922) and surname typos (603 of 899, Splink 899). Two things combine:
    - the wide net reaches duplicates our rules never see (shared birth
      date, name sound by district);
    - Splink's score makes that net affordable: at 10K it holds 17,526
      pairs, and the score keeps 1,117 of them while losing none of its
      duplicates.
  - **The 104-person file is a tie** (22 against 23 of 27 at 24 pairs). Our
    presets were designed on that file, and 104 records are too few to
    train Splink fully (it warns that some levels went untrained).
  - **Neither finds "nickname, moved"** (2 of 911 at 100K): a new first
    name, no birth date, new email and postcode leave only the surname.

- **Lessons for the service:**
  - **Training needs care.** EM over loose groups (same birth date, same
    surname sound) settled on "same family", not "same person", and
    learned that duplicates rarely share a phone. Precise groups (email
    username, then full name) fixed it.
  - **Untrained levels need help.** "Names swapped" and close name spellings
    never appear in those groups, so at 100K they score low (median weight
    about −19) and are found only far down the list: 90% costs 62,715
    pairs, not a few thousand. Choosing training groups that include them,
    or sensible starting values for rare levels, should close most of that.
  - **The wide net must scale:** surname sound alone was 73M pairs at 100K
    (common surnames), so it's narrowed by birth year.
  - **The data is synthetic.** The hard kinds are the generator's own, and
    its phone numbers collide by chance. Real files will differ, which is
    what item 6's pre-run check against vendor pairs is for.
- **The service, built** (`services/splink/`, `docs/rules/splink-service.md`):
  - **Python 3.13, Splink and DuckDB pinned.** Records in and scored pairs
    out, as files: the worker writes each saved dataset's records (cleaned by
    our own blocking code) and runs `python -m pairsight_splink score`, one
    dataset at a time, beside the runs. Pairs at or above a storage floor
    (match weight −10) go to `pair_scores`. Python never touches the database,
    Jev, runs or vendors, and nothing waits on it.
  - **The dataset row is the job** (`source_datasets.scoreStatus`): pending
    when saved (or when a plan first asks, for datasets from before Splink),
    then running, then done, skipped (under 200 records, not people, or not
    set up) or failed.
  - **First use, on the Plan:** "Pairs Splink picked +N" joins the rules'
    and vendors' pairs (weight 0 or more), with overlaps removed and the
    100K limit applying. Runs record them, and Results name them "Picked by
    Splink". A switch in Rules turns it off; while Splink works, the plan
    says so and refreshes itself.
  - **Model improvements over the spike,** still with no labels:
    - a third training pass (same surname sound and birth date), which
      sees typos and swapped names;
    - starting values for the levels training can't see (swapped names,
      close spellings, birth-date closeness), which training replaces when
      it does see them.

    |                            | 10K                  | 100K                 |
    | -------------------------- | -------------------- | -------------------- |
    | Splink at weight 0         | 91.2% (1,107 pairs)  | 90.1% (27,720 pairs) |
    | Pairs to match the presets | 794 (presets 12,888) | 8,770 (presets 1.2M) |
    | Time, true peak memory     | 8 s, 0.4 GB          | 22 s, 4.8 GB         |

    100K needs 27,720 pairs for 90%, down from the spike's 62,715. On a
    2,000-person file Splink now finds every swapped name and typo (38 the
    default rules miss); before the starting values it found none. The
    spike's 1.8 GB peak at 100K was sampled between steps; 4.8 GB is the
    true peak. The app's 10K-record limit keeps it near 0.4 GB.

  - **Checks:** `pnpm splink:setup` makes the local environment and
    `pnpm python:check` runs ruff and pytest, as a CI job (`python`) and a
    local-review gate. `check:standards` requires it whenever a
    `pyproject.toml` is tracked. ESLint keeps `node:child_process` to the
    one runner (`src/server/pairsight/splink/service.ts`).
  - **On-prem:** `services/splink/Dockerfile`; `SPLINK_PYTHON` points the
    worker at a wrapper that runs it. Full on-prem packaging stays under
    "Later".
  - **Benchmark:** `scripts/splink-spike/` now scores the service's own
    model, for any later change to it.

### 6. Automatic pair selection: works on the first run (built, 2026-10-07)

- **Built:**
  - **PairSight suggests the pairs by default.** A new people evaluation
    with 200 records or more starts with no comparison rules: the pairs
    item 5's service scores at weight 0 or more are suggested, shown as
    "Suggested by PairSight". The screens never name the technology behind
    it (`docs/rules/copy.md`; `src/i18n/copy.test.mts` fails on the names).
  - **Rules screen:** a card at the top, "PairSight suggests the pairs",
    with its switch, how many it suggests, what they share in plain words
    ("the same date of birth (64%) · first and last names swapped (5%)",
    from each pair's reasons) and the pre-run check per vendor ("These
    would also find 19 of the 21 pairs Vendor A matched"). Your own rules
    sit under "Advanced", closed unless rules are on or suggestions aren't
    picking.
  - **Never an empty plan by accident.** Files under 200 records and other
    types save the type's default rules, as before. If suggestions are
    unavailable or fail and no rule is on, the plan uses the default rules
    and says so. Switched off on purpose, it's your rules as set. While
    suggestions are being worked out, Start waits.
  - **Each pair says why:** the service turns each pair's per-field levels
    into reason codes (`pair_scores.reasons`); the pair page says "Suggested
    because they share the same date of birth, first and last names
    swapped", and the scoring job tallies them once for the Rules card.
  - **No safety sample.** On the benchmark the pairs below the floor hold
    almost no duplicates (0 of 87 missed at 10K): the misses are pairs never
    scored at all, which no affordable sample reaches, so it would almost
    always report "0 found". Instead Results' coverage panel and the PDF
    say plainly that suggested pairs share something PairSight compares (a
    name, date of birth, email, phone or postcode), and pairs sharing none
    of these weren't checked.
- **Left for later:** Jev's answers sharpening the next run. (Removing the
  TypeScript rules: done in item 11.)

- **What:**
  - The funnel replaces hand-built rules as the default: wide net,
    weights, Splink score, floor.
  - Jev checks a safety sample below the floor, and the report says what
    it found.
  - No second run needed: Splink learns from the records themselves.
- **Rules screen:**
  - "We picked these for your data": what's checked and why, in plain
    words from Splink's per-field explanation.
  - A pre-run check: "these would also find 19 of the 21 pairs your
    vendors matched". Vendor pairs are used only for this check, never to
    choose.
  - Manual rules stay as an option.
- **Afterwards:** Jev's answers can sharpen the next run. Once nothing
  uses the TypeScript blocking code, it goes, so two engines can't
  disagree.
- **Depends on:** item 5. It supersedes the earlier "rule suggestions
  learned from past runs" idea, which needed a second run.

### 7. Big-run shortcuts: verified auto-accept (deferred, 2026-10-07)

- **Deferred: measured, and not worth it yet.** On the benchmark, "certain"
  holds only at a high bar, and there it covers few pairs:

  | Match weight | 10K: planted duplicates | 100K: planted duplicates |
  | ------------ | ----------------------- | ------------------------ |
  | 10 or more   | 99.0% of 406 pairs      | 80.6% of 4,669 pairs     |
  | 15 or more   | 100% of 401             | 99.5% of 3,743           |
  | 20 or more   | 100% of 388             | 100% of 3,454            |

  At weight 20 only about 12% of the 27,720 pairs suggested at 100K would
  skip Jev: about a minute and $0.25 on a 100K-pair run, now that Jev checks
  about 360 pairs a second (item 4) and suggestions cut pair counts 10–40×
  (items 5–6). The synthetic data has no relatives at one address, exactly
  the "certain" pairs your definition calls different, so real data would
  be riskier, not safer.

- **Revisit when** real customer runs show Jev time or cost hurts. Measure
  precision on real data, with relatives, first.
- **What building it would take** (mapped 2026-10-07): an auto-accept can't
  live on the shared Jev judgment (later runs would reuse it as a Jev
  answer, and earlier runs' results would shift once Jev checked it). It
  needs a per-run record with the weight frozen at start, its own bucket in
  the progress counts, the speed estimate and every metric ("says same,
  outside the score bins"), a summary version bump, and the report's "every
  answer here is Jev's" reworded.

The plan as first written:

- **What:** Fellegi–Sunter's three zones, with Jev as the reviewer.
  - Pairs Splink is certain about (above an upper threshold) skip Jev,
    **except a random sample Jev checks, measured per vendor**.
  - If Jev disagrees too often, the threshold rises automatically.
  - The middle zone always goes to Jev.
  - Below the floor, only our own pairs are dropped; never a vendor pair.
  - The report says plainly which numbers rest on a verified sample.
- **Why careful:** Splink's "certain" can include pairs your definition
  says are different (a father and son at one address). And a vendor that
  matches like Splink would otherwise go unchecked. The per-vendor sample
  keeps the grading fair.
- **When:** only for runs big enough that time matters (tens of thousands
  of pairs). Small runs keep checking everything exactly.
- **Depends on:** items 4–6.

### 8. Replace the pair cap with an estimate (built, 2026-10-06, with item 4)

- **Built:**
  - **The limit is 100,000 pairs per run** (was 5,000): about 10 minutes of
    Jev at today's speed. The Plan screen's time and cost (item 4) are the
    estimate; there's no extra confirm step (decided 2026-10-06).
  - **Why not higher yet:** the Rules and Plan pages build a plan's pairs on
    every view. Up to 100K that stays quick (measured below); past it, pairs
    need working out once and storing, which comes with item 6.
  - **A real guardrail for runaway groups.** Each rule's pairs are counted
    from its group sizes first (n(n−1)/2 per group), and pairs are built only
    up to the limit: a rule picking millions (5,000 records sharing a key) is
    counted exactly, never built. The plan is blocked with that rule named
    and a Turn off button, and the screens say "far more than one run can
    check" rather than a made-up total. The Rules screen's per-rule numbers
    no longer build pairs at all.
  - **Starting a big run:** one transaction (a failed start leaves nothing),
    writing in batches of 5,000 with time to match its size, reading earlier
    scores once instead of twice. The button says "Getting 99.7K pairs
    ready…" for big runs.
  - **The time estimate learns from this server's pool only** (the e2e
    suite's stub runs share the local database with real ones) and weighs
    runs by size: all their checks over all their time, so start-up time in
    small runs doesn't make big ones look slow.
  - The vendor file message now names the limit it's checked against
    (100,000 rows), not the pair limit.
- **Measured** (local, Jev stub, 447 records in one group: 99,681 pairs):

  |                                 | Time                |
  | ------------------------------- | ------------------- |
  | Rules page                      | 0.6 s               |
  | Plan page                       | 1.4 s               |
  | Start (click to the run's card) | 24.5 s              |
  | Checking every pair             | 4 min 35 s (~360/s) |
  | Results page                    | 1.3 s               |

  Stub answers are instant, so with real Jev (0.4–0.8 s a call) checking
  is Jev-bound: about 7–14 minutes at 100–200 calls at once. No real Jev
  credits were used for this test.

- **Depends on:** items 1 and 4.

### 9. Splink as a free baseline vendor (dropped, 2026-10-07)

- **Dropped.** PairSight evaluates matching tools; it isn't one. Showing its
  own picks as a competing vendor would read as claiming to beat the tools
  it grades, and confuse the people choosing between them. Its picks stay
  internal: "Suggested by PairSight" decides what Jev checks, and never
  appears as a contender in the comparison.
- **The idea, as first written:** Splink's own matches in the comparison
  like a vendor's, judged by Jev ("Vendor A beats the free open-source
  baseline by 12 points").

### 10. Suggestions for every type (built, 2026-10-07)

- **Why:** item 6 only suggested pairs for people; organisations and
  products still started from hand-written rules. Every type now gets
  PairSight's suggestions, the first step to removing the TypeScript rules
  entirely (item 11).
- **Built:**
  - **One model per type** in `services/splink/` (`person.py`, `company.py`,
    `product.py`), chosen by `score --entity-type`; `model.py` trains and
    scores whichever one a file is for. People's model is unchanged.
  - **Organisations** compare the cleaned name (legal suffixes stripped,
    with levels for the same words in another order, one record's trading
    name being the other's name, and close spellings), company number, tax
    ID, website, email, phone, postcode and city. Wide net: each ID, the
    exact name, name sound with postcode district or city, and postcode.
  - **Products** compare barcode, part number, SKU, name, brand (with a
    close level for a brand written two ways), manufacturer, category, size
    and colour. Another size or colour is another product, so those differ
    strongly against; the model number only widens the net, since a
    product's variants share it.
  - **Held weights and a floor.** Unsupervised training can't see what it
    never meets in its training groups: two records of one firm rarely both
    carry its number, so a different company number learned nothing, and
    two firms with one name in one city looked alike; a file full of
    variants taught that duplicates often carry different barcodes. Those
    fields now hold their weights (`spec.held_exact`). And on 2,000 records
    EM learned some levels as near-impossible for a duplicate (a swapped
    name at -985), so every learned level now keeps at least 5% of real
    duplicates (`M_FLOOR`): a difference counts against, but never alone.
  - **Reasons** for each type (the same company number, the same barcode,
    a brand written a little differently…), in plain words on the Rules
    card and the pair page; the copy that described people only now names
    each type's fields.
  - Datasets skipped before as "not people" were re-queued
    (`prisma/run-once.sql`). `normalizeCompanyName` now also drops
    "public" from the end, so "Public Limited Company" and "PLC" agree.
- **Measured** (`scripts/splink-spike/`, new seeded generators
  `scripts/scale/companies.mts` and `products.mts`, 10% planted duplicates,
  40% of them hard; products also plant variant traps). Splink at the plan's
  floor (weight 0) against the default rules:

  | File               | Splink: pairs, found | Default rules: pairs, found | Splink at the rules' pairs |
  | ------------------ | -------------------- | --------------------------- | -------------------------- |
  | People 2K          | 166, 78.0%           | 158, 66.0%                  | 74.2%                      |
  | People 10K         | 1,128, 91.2%         | 1,188, 70.6%                | 91.2%                      |
  | People 100K        | 31,154, 90.1%        | 50,706, 70.3%               | 90.1%                      |
  | Organisations 2K   | 149, 78.8%           | 125, 63.1%                  | 69.8%                      |
  | Organisations 10K  | 926, 79.9%           | 860, 66.6%                  | 79.5%                      |
  | Organisations 100K | 28,255, 88.6%        | 29,703, 66.6%               | 88.7%                      |
  | Products 2K        | 255, 99.0%           | 1,242, 78.4%                | 100%                       |
  | Products 10K       | 1,159, 97.9%         | 6,267, 75.9%                | 99.9%                      |
  | Products 100K      | 12,490, 94.7%        | 72,314, 75.5%               | 99.4%                      |
  - **Variant traps** (products: same line, another size or colour) in the
    plan: 62 of 1,141 at 2K, 228 of 5,710 at 10K, 2,856 of 57,312 at 100K;
    the default rules bring up 1,089, 5,443 and 54,750. Jev still judges
    each, so a trap costs a check, not a wrong answer.
  - **What Splink misses:** organisations that moved city and changed
    website, with only the name in common (the rules found 4 of 110 at 10K;
    a shared name across cities is genuinely weak evidence), and people
    with a nickname who moved (outside the wide net, as before).
  - **Time and memory:** under 3 s and about 0.45 GB at 10K for every type;
    at 100K, 24 s and about 5 GB for people, 6 s and 1.9 GB for
    organisations, 7 s and 2.4 GB for products. People's 100K plan grew
    from 27,720 to 31,154 pairs with the floor, for the same duplicates.
  - The data is synthetic: the generators plant the kinds of duplicate a
    records team meets, but real files will differ. Item 0's caveat stands.

### 11. PairSight picks every pair: the rules removed (built, 2026-10-07)

- **Why:** with suggestions working for every type (item 10), two engines
  picking pairs could only disagree. The hand-written rules, the switch for
  suggestions and the "Advanced" section go: every plan is the pairs
  PairSight suggests plus every pair a vendor matched.
- **Built:**
  - **No rules anywhere.** The rule engine (`blocking.ts`, presets, custom
    and close-match rules, the rules preview, `pnpm blocking:check`), the
    Rules screen's rule list and editor, the Plan's "Turn off" and the
    "hard cases" readout are gone. The key code the service still needs
    moved: `match-keys.ts` (`matchKey`) and `scoring-records.ts`.
  - **Data:** `evaluations.blockingRules`, `evaluations.splinkPicks` and
    `runs.blockingRules` dropped; `run_pairs.ruleIds` became
    `run_pairs.isSuggested`, backfilled by a hand-written migration (a pair
    any rule or suggestion picked counts as suggested). Run summaries move
    to version 3 and rebuild on their next read.
  - **Small files are refused.** A records file under 200 records can't
    teach the model anything, and there's nothing to fall back on, so the
    upload says how many it needs. Files saved before that say so on the
    Plan.
  - **When suggestions can't run,** the Plan says so and offers Try again,
    which queues the scoring again. Start still waits while PairSight works
    the pairs out.
  - **"What Jev checks"** is the step's new name: what counts as the same,
    what Jev sees, the country and the match cut-off, beside the pairs
    PairSight suggests and what they share.
  - **Results, the pair page, exports and the report** say "Suggested by
    PairSight" or "Added because a vendor matched it".
  - **Two fixes to the service** found on small, sparse files: a training
    pass with no pairs is skipped up front (Splink took its fields out of
    the model before failing), and when nothing anchors the estimate of how
    many pairs are duplicates it assumes about 5% of records have one. The
    benchmark is unchanged.
  - **End-to-end tests** pad each fixture past 200 records with distinct
    fictional filler (`e2e/padding.ts`), so each test's own pairs still
    decide its outcome.

### 12. Profile the records before picking pairs (built, 2026-10-10)

- **Why:** real files carry stand-ins for "not known" ("N/A", all zeros,
  `test@test.com`, a date of birth of 1 January 1900), values hundreds of
  records share (a switchboard, `info@`), dates written day or month first
  and phones from abroad. To a matcher, two strangers who both say "N/A"
  look alike, and a date it can't read is no evidence at all. The research
  is clear on what helps: blanket cleaning barely moves accuracy and heavy
  cleaning hurts it (Randall et al. 2013, BMC Medical Informatics; Grannis
  et al. 2019, JAMIA), while turning stand-ins into blanks helped every time
  and Splink's own guidance is to profile first and add cleaned values
  rather than overwrite. So the file is profiled once, and the profile
  decides a few targeted fixes, applied only to the values pairs are picked
  by. Jev, the comparison view and every screen keep what the file says.
- **Built:**
  - **The profile** (`src/server/pairsight/profile/`), worked out when a
    file is saved and kept on `source_datasets.profile`: per field, how
    many records have a value, how varied it is, its commonest values, how
    many can't be read (phones, emails, dates), the stand-ins, and which
    way round its dates are written. A value is a stand-in when it's a
    known filler, or when at least 10 records and 0.5% of the file share it
    in a field where each record's should be its own (email, phone, date of
    birth, company number, tax ID, website, barcode, part number, SKU). The
    date order comes from the whole column (a part above 12 settles it),
    else the evaluation's country. Scoring profiles again if the country
    has changed since, and profiles files saved before this.
  - **Keys from the profile** (`profile/clean.ts`, through `matchKey`): a
    stand-in is blank, and so is every key made from it; a date of birth is
    one ISO date however it was written; a phone is read for the record's
    own country, and gets back a leading 0 a spreadsheet dropped.
  - **"What we noticed in this file"** on Records lists the stand-ins, the
    shared values, how the dates are read and anything unreadable, with how
    full each field is in a tip. A clean file gets one line saying so.
  - **Reading files as written:** a CSV that isn't UTF-8 is read as
    Windows Western European text (and the upload says so) rather than
    turning "Zoë" into "Zo�"; an Excel number padded with zeros by its
    format ("07700 900123") keeps them. These change the stored values, so
    Jev sees them too: they're how the file reads, not a cleaning.
  - **Organisation names** drop a few more legal forms ("Pvt Ltd",
    "GmbH & Co. KG", "Limited Liability Partnership") and a leading "The".
  - **The benchmark plants the mess** (`scripts/scale/defects.mts`,
    `export.mts --defects`): stand-ins in 5% of records, a shared value in
    3%, phones that lost their 0 (10%), Irish people with phones written
    two ways (5%), and every date of birth day first. `score.py` reports
    the duplicates each defect touched.
- **Measured** (plan's floor; duplicates found, pairs to check, pairs the
  wide net scored):

  | File                     | Before                      | After                       |
  | ------------------------ | --------------------------- | --------------------------- |
  | People 10K, clean        | 91.2%, 1,128, 17,526        | unchanged                   |
  | People 10K, messy        | 65.5%, 785, 69,715          | 88.0%, 1,069, 16,991        |
  | People 100K, clean       | 90.1%, 31,154, 1.67M        | unchanged                   |
  | People 100K, messy       | 52.6%, 7,424, 6.93M (137 s) | 87.4%, 26,835, 1.61M (23 s) |
  | Organisations 10K, clean | 79.9%, 926, 6,022           | unchanged                   |
  | Organisations 10K, messy | 79.9%, 815, 99,383          | 79.9%, 923, 5,997           |
  | Products 10K, clean      | 97.9%, 1,159, 14,082        | unchanged                   |
  | Products 10K, messy      | 95.3%, 1,167, 26,023        | 97.9%, 1,172, 14,075        |

  On messy people, the unreadable dates had taken out every duplicate that
  leans on the date of birth (a typo, swapped names): 2 of 92 and 2 of 112
  found, back to 84 and 108. What's still missed is a duplicate whose only
  shared detail was replaced by a stand-in: that evidence is gone.

- **Measured and not built:**
  - **The profile steering the model** (term frequency and wide-net rules
    per column, in the service). Once stand-ins and shared values are
    blank, no wide-net rule is skewed (each holds a few hundred pairs at
    10K), and the skewed fields (city, brand, category) already have term
    frequency or held weights. Nothing for it to change on the benchmark;
    worth another look if a real file shows a wide-net field dominated by
    a value that isn't a stand-in (a head office's postcode, say).
  - **The longer legal-form list doesn't move "suffix and & written
    differently"** (4 of 79): those names already clean to the same key.
    They're firms with common names, no ids and another postcode, and the
    evidence is thin, not dirty. The list is for real files' forms.
- **Left for later:** address parsing into extra keys (house number,
  street); showing on the Plan when training was skipped or the duplicate
  share assumed (`scoreSummary`); flagging Excel numbers of 16 digits or
  more, which lose digits before PairSight sees them.

### Later

- **On-prem packaging:** web, worker, Splink service and Postgres as
  containers, with the customer's own Jev key. In progress, Windows first:
  see `docs/PairSight-OnPrem.md`.
- **Rerun item 0's scale files** at 100k and 1M once items 1–6 exist.
- Human review, analytics events, the prompt-audit fixes, vendor-specific
  file formats and legacy `.xls`, verified ground-truth uploads and an
  "uncertain" result group: see `docs/PairSight-Delivery-Plan.md`,
  "Roadmap".

## Open questions

- Jev's rate limit: none hit at 200 calls at once (item 4), and runs now
  wait out pushback rather than fail. TypeSafe's own price is still unknown.
- What file sizes customers will actually bring, and how many of their
  duplicates are relatives at one address. It decides whether item 7 comes
  back, and whether the 100K pair limit (item 8) needs raising.
- Settled: no queue tables (item 1: a running run is the job); Python in CI
  runs as its own job with a pip cache (item 5).
