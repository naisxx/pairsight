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

### 5. Splink scoring service

- **Spike first:**
  - Run Splink on the planted-duplicate file and the synthetic 10k/100k
    files. Measure duplicates caught, pairs produced and speed against
    today's yardstick (`pnpm blocking:check`: exact rules 37%, close-match
    presets 85%).
  - Ship only if it beats that with fewer pairs.
- **Then the service:**
  - A Python + DuckDB process with the narrow boundary above, a pinned
    Splink version, and its own lint, tests and build added to
    `local-review` and CI.
  - Runs as a job from the worker.
  - Packaging for local dev and on-prem.

### 6. Automatic pair selection: works on the first run

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

### 7. Big-run shortcuts: verified auto-accept (only above a size)

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

### 9. Splink as a free baseline vendor (optional)

- **What:** Splink's own matches appear in the comparison like a vendor's,
  judged by Jev the same way. For example: "Vendor A beats the free
  open-source baseline by 12 points". Strong evidence for the
  buy-or-not decision.
- **Depends on:** item 5.

### Later

- **On-prem packaging:** web, worker, Splink service and Postgres as
  containers, with the customer's local Jev.
- **Rerun item 0's scale files** at 100k and 1M once items 1–6 exist.
- Human review, analytics events, the prompt-audit fixes, vendor-specific
  file formats and legacy `.xls`, verified ground-truth uploads and an
  "uncertain" result group: see `docs/PairSight-Delivery-Plan.md`,
  "Roadmap".

## Open questions

- Jev's rate limit: none hit at 120 calls at once (item 0). TypeSafe's own
  price is still unknown.
- Queue tables versus the migrations and RLS rules (item 1).
- What file sizes customers will actually bring. It decides when items 7
  and 8 matter.
- Python in CI: the runner, and caching Splink's dependencies (item 5).
