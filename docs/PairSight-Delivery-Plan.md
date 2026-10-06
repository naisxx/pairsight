# PairSight delivery plan

The implementation reference for PairSight. It was agreed as a baseline on
2026-09-30, and further changes are expected. The domain rules (pairs,
categories, runs, limits, Jev facts) live in
[PairSight-V1-Scope.md](PairSight-V1-Scope.md). This file covers how we
build it: the architecture, the milestones, and how we verify each one.

**Friday target (2026-10-02):** one usable slice.

> sign in → create evaluation → upload source CSV and one vendor pair CSV →
> map fields and fix validation errors → identity and blocking → review the
> plan → run real Jev with visible progress and failures → four-category
> comparison with filters → inspect a disagreement → reopen later

Plus a public, clearly labeled sandbox on fictional data (`/sandbox`: the
whole app, read-only). Multiple vendors are
added only if the core loop is stable. The data model supports them from
the start, without duplicating any Jev work.

## Approved decisions

- **Dependencies:** `papaparse` (CSV parsing) and `libphonenumber-js`
  (phone normalization with a country). Install them in M1.
- **UI:** follow [PairSight-UX-Plan.md](PairSight-UX-Plan.md): shadcn/ui
  (with Phosphor icons, not lucide), shadcn charts (Recharts), and
  `next-themes` for Light / Dark / System.
- **Jev access:** TypeSafe's own API. The key goes in `.env.local` at M1;
  its name is added to `.env.example` and `src/lib/env.ts`.
- **Jev cost in `ai_usage`:** priced at OpenRouter's rate for
  `typesafe/jev-1.13` ($0.042 per million prompt tokens, $0 completion)
  until TypeSafe's own price is known. That rate is a stand-in: say so
  wherever cost is reported.

## Architecture

| Layer                            | Location                             | Responsibility                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain logic (pure, unit-tested) | `src/server/pairsight/`              | `csv.ts` (parse and validate), `normalize.ts`, `blocking.ts`, `pairs.ts` (canonical order, dedupe, group expansion, union), `limits.ts`, `decisions.ts` (threshold and categories), `judgment.ts` (Jev request, response parsing, config key) |
| Data access                      | `src/server/pairsight/store.ts`      | Every function takes `ownerId`. Another user's evaluation returns 404.                                                                                                                                                                        |
| Run engine                       | `src/server/pairsight/run-engine.ts` | Claims pending assessments and calls Jev                                                                                                                                                                                                      |
| Jev provider                     | `src/server/ai/typesafe.ts`          | The only file that calls TypeSafe. Wraps `trackAiCall`, following the `anthropic.ts` pattern.                                                                                                                                                 |
| Session                          | `src/server/auth/session.ts`         | `requireUser()`: Supabase session → `provisionUser` → `User`                                                                                                                                                                                  |
| Mutations                        | server actions via `validatedAction` | Zod input; `AppError` for user-caused failures                                                                                                                                                                                                |

**AI tracking:**

- Add provider `typesafe` with an extractor for
  `usage.{input_tokens, output_tokens}`.
- Register the model and add a pricing path for its `decisions` output. The
  `ai_usage` columns don't change.
- Record feature `pairsight_pair_judgment`, with `meta` holding ids only.

**Run execution: a background worker over work claimed in the database.**

- **Starting a run** freezes a snapshot and creates the run's pairs and any
  missing pending assessments. Only this run's own failed pairs get another
  attempt.
- **The run worker** (`src/server/pairsight/worker/run-worker.ts`) lives in
  the web server, started once at boot from `instrumentation.ts`. Every
  second it looks for runs with status `running`, and keeps each one's calls
  topped up with `startRunCalls` as answers come back (never waiting on a
  batch, so one slow call holds only its own slot), which:
  - claims pending assessments that are due (`nextTryAt`), plus
    any "running" ones whose claim is stale (twice the call timeout plus
    20 s: reclaimed after a crash, a restart or a failed save)
  - calls Jev through the server's one shared limit
    (`worker/jev-limiter.ts`), split evenly across running runs: it starts
    at `RUN_WORKER_CONCURRENCY` (100), climbs to
    `RUN_WORKER_CONCURRENCY_MAX` (200) while Jev keeps up, halves on
    pushback and stops for a while when Jev is down; each call times out
    after `TYPESAFE_TIMEOUT_MS` (20 s)
  - on busy, rate-limited, down, slow or garbled answers, releases the pair
    with a time to try again (backoff, honouring `Retry-After`), never
    failing it, and marks the run waiting (`runs.waitingSince`)
  - asks again when an answer has no usable score, up to 3 times
  - fails a pair only when Jev refuses it (400, 413, 422) or never gives a
    usable answer
  - stops the run when the key is missing, or refused for about a minute

  (Scale Roadmap item 4 has the table of every outcome.)

  When nothing is left to claim and nothing is in flight, `finishIfDone`
  marks the run complete.

- **No queue library.** A running run is the job and each pair is claimed
  with a compare-and-set, so loops, tabs or servers never judge one pair
  twice. No queue tables, no second database path.
- **The Runs centre only watches.** It polls each running run's progress
  every second, and the runs list every few seconds while anything runs,
  so a run started in another tab shows up too. Runs keep going with no
  page open.
- **Progress is stored, not counted.** Each run keeps how many of its pairs
  have a final answer and how many failed (`runs.checkedCount`,
  `failedCount`): a pair's answer adds to every running run holding it, and
  an exact recount runs when counts can shift otherwise (a run starting, a
  retry, a re-check, a run finishing). Following a run costs the same at any
  size. A run is marked finished as soon as its last pair is checked, then
  its results are worked out ("All pairs checked · working out the results")
  before it's complete.
- **Pause and resume.** Pause stops the run after the pairs already being
  checked; Resume carries on. **Retry failed** resets failed pairs to
  pending.
- **Why in the web server, not its own process:** almost every server module
  is `server-only`, so a separate Node process can't load the engine, the
  Jev client or the AI-cost tracker as they are. Jev calls wait on the
  network rather than the CPU, so they don't slow pages. `RUN_WORKER_CONCURRENCY=0`
  turns the worker off on a server that should serve pages only.

**Reading results: from the database, never the whole run** (Scale Roadmap
item 2).

- **The Overview is worked out once.** When a run finishes, `finishIfDone`
  builds its summary (`run-summary.ts`) before marking it complete and
  stores it on the run (`runs.summary`, `summaryVersion`). It holds:
  - a count table: pairs grouped by status, 0.01 score bin, Jev's decision
    and close call at the run's cut-off, which vendors matched (a bitmask)
    and why it was checked. Every Overview number, the dashboard's and the
    report's come from it exactly (`src/lib/pairsight/stats.ts`), including
    the 0.05 cut-off sweep and the threshold preview's 0.01 steps.
  - pairs per rule, the field patterns per vendor over **every** judged pair
    (walked a page at a time), each vendor's top disagreements, the Jev
    versions and the record count.
    Results read it in milliseconds whatever the run's size. A run finished
    before summaries existed builds one on its first read.
- **Kept current.** Judgments are shared between runs of the same records and
  settings, so when a run finishes or a pair page re-checks a pair, the
  summaries of the other finished runs sharing them are cleared and rebuilt.
  Unfinished runs show progress, never numbers.
- **Detailed analysis is live SQL** (`results-query.ts`, `$queryRaw` because
  it needs array tests, grouped counts and window functions): the same
  filters, search and order as before, a page at a time with an exact count,
  and a pair's position and neighbours for J/K.
- **Requests stay bounded** (`docs/rules/database.md`, "Bounded queries"): a
  request reads `run_pairs` alone, joining records and judgments only for
  the rows it shows. Building the summary copies each pair's status, score,
  sort key (`least` of its records' `sortKey`) and search text onto it, a
  chunk of records at a time, so a summary and its pages always agree.
  Records carry `label`, `sortKey` (the reference as a natural-order key,
  hex so the index serves it) and `searchText`, filled when saved.
- **Downloads stream.** The findings CSV and Excel files are written a page at
  a time, walking records in natural order through their index, so memory
  stays flat. Excel stops at 1,048,575 rows; past that the menu offers CSV
  only.
- `pnpm scale:check-results` compares all of this against the pair-by-pair
  results on the local database's runs; `pnpm scale:seed-run` and
  `pnpm scale:measure-results` time it at 200k and 1M pairs.

**Data model** (`prisma/schema/pairsight.prisma`; every table gets an RLS
migration):

| Model                | Key fields                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Evaluation`         | `ownerId?` (null for the demo), `name`, `kind` (live or demo). Draft configuration: `identitySame`, `identityDifferent`, `countryCode`, `jevFields[]`, `blockingRules` (JSON), `threshold`                                                                 |
| `SourceDataset`      | `evaluationId`, `fileName`, `rowCount`, `referenceColumn`, `columnRoles`. Immutable: replacing the file creates a new dataset. `savedAt` is set once every record is in; only saved datasets are current.                                                  |
| `SourceRecord`       | `datasetId`, `reference` (unique per dataset), `rowNumber`, `values` (original values, JSON), and for reading results `label`, `sortKey`, `searchText`                                                                                                     |
| `VendorExport`       | `evaluationId`, `datasetId`, `name`, `format` (pair, later group), `mapping`, `confirmedCompleteAt`, `pairCount`                                                                                                                                           |
| `VendorMatch`        | `exportId`, `recordAId`, `recordBId` (canonical order, unique)                                                                                                                                                                                             |
| `Run`                | `evaluationId`, `datasetId`, `number`, `origin` (live or prepared), `status`, and a frozen snapshot: identity definition, `jevFields`, country, rules, `exportIds[]`, `judgmentKey`, requested model, `threshold`; `summary` (the Overview, once finished) |
| `RunPair`            | `runId`, `recordAId`, `recordBId`, `ruleIds[]`, `matchedByExportIds[]`, `assessmentId`, and as of the summary `status`, `score`, `sortKey`, `searchText`                                                                                                   |
| `Assessment`         | `datasetId`, record A/B, `judgmentKey`, `status` (pending, running, succeeded or failed), `score?`, `modelReported`, `requestId`, `attempts`, `errorCode`, `claimedAt`, `completedAt`, `origin`                                                            |
| `Upload`             | `ownerId`, `evaluationId`, `kind` (records or vendor), `fileName`, `size`, `bytes`. A file kept while it is checked; deleted once saved or after a day.                                                                                                    |
| `HumanReview` (next) | `runPairId`, `reviewerId`, `verdict` (same, different or unsure), `note`. Kept separate from AI judgments.                                                                                                                                                 |

- **Reuse:** `judgmentKey` is a hash of the identity definition,
  `jevFields`, country, requested model and request-template version. The
  threshold isn't part of it. Assessments are unique per (dataset, pair,
  key), so a new run reuses succeeded assessments and only sends new pairs
  to Jev.
- **Categories are computed when read**, from the run's threshold and
  `matchedByExportIds`, so a threshold change never calls Jev.

## v1 choices

- **Source file:** CSV (UTF-8, BOM allowed, header row, comma-delimited) or
  Excel, ≤ 10 MB, ≤ 10,000 rows. It's uploaded once to
  `PUT /api/evaluations/[id]/uploads` and kept in `uploads` while it's
  checked; it's read and saved a batch of rows at a time (Scale Roadmap item
  3). An empty cell is missing. The reference is trimmed, required and
  unique; errors list row numbers.
- **Vendor pair CSV:**
  - The user picks the "record A" and "record B" columns. Other columns,
    including vendor scores, are ignored and never sent to Jev.
  - Self-pair rows are skipped with a count, and duplicate or reversed
    rows collapse.
  - An unknown reference is an error listing its rows. Confirming the
    export is complete is required.
  - **Group CSV** (`record_ref`, `group_id`) comes next; the expansion
    rules are in the scope doc.
- **Field roles:** full name, first name, last name, email, phone, date of
  birth, address, city, postcode, country, other. Jev receives the
  user-selected mapped fields (default: all), with original values.
- **Blocking:**
  - Presets: Email, Phone, Name, Name + postcode.
  - Postcode normalization: trim, uppercase, remove spaces. The other
    normalization rules and missing-value handling are in the scope doc.
- **Identity definition:** two text areas, "Counts as the same individual"
  and "Does not count", prefilled with editable defaults. They map onto
  `criteria.true` and `criteria.false`. The `state` holds only the two
  records' fields and the country.
- **Threshold:**
  - A pair is a match when `noul ≥ threshold`. The threshold is set in
    Rules (presets 0.35 / 0.50 / 0.70, or custom), and each run keeps its
    own. Results preview other values but never change a run's.
  - The default, 0.5, was confirmed by the M1 test.
  - A band around the threshold raises a "low confidence" filter, not a
    category.
- **Sign-in:** email and password against local Supabase, through server
  actions using the existing auth-only client.
- **UI:** design tokens and the `ui/` components. Add Select, Checkbox,
  Progress and Tabs only when a screen uses them. Strings go through
  next-intl; filters live in URL params; TanStack Query drives the run
  loop. Categories use neutral styling, never success or danger colors,
  because they mean agreement, not correctness.

## Screens

| Screen                        | Contents                                                                                                                                                                                            | States                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/` landing (minimal)         | The problem, three steps, **Explore the sandbox**, **Start evaluation**                                                                                                                             | —                                                                              |
| `/sign-in`, `/sign-up`        | Email and password                                                                                                                                                                                  | Invalid credentials, redirect on success                                       |
| `/evaluations`                | Saved evaluations                                                                                                                                                                                   | Empty state with create and sandbox actions                                    |
| Workspace `/evaluations/[id]` | Stepper: Records → Vendors → Rules → Plan → Results (runs: the Runs centre)                                                                                                                         | Each step: complete or needs attention                                         |
| Records                       | Upload, preview of the first 10 rows, reference column, role per column                                                                                                                             | Parsing; file errors; missing or duplicate reference table; success            |
| Vendors                       | Name, file, A/B columns, completeness checkbox, vendor list                                                                                                                                         | Unknown-reference table; self-pair and duplicate counts                        |
| Rules                         | Identity text areas, country, fields sent to Jev, rules with live counts                                                                                                                            | Warning above 50 records per bucket; no-rules state                            |
| Plan                          | Pair counts by source, pairs outside blocking, reduction, reused assessments, limit check, **Start evaluation**                                                                                     | Over-limit block with its cause; open validation errors block starting         |
| Runs centre (top bar)         | Every run as a card: progress and counts, details, Retry failed, Resume                                                                                                                             | Running, paused/resume, config error, failures with **Retry failed**, complete |
| Results                       | Vendor tabs, four category counts plus an incomplete count, threshold control, "agreement, not correctness" wording, filters (category, outside blocking, low confidence, incomplete), pairs table  | Empty filter result; incomplete-run warning                                    |
| Pair inspection               | Records side by side with differences highlighted, each vendor's decision, Jev score/model/time, decision at the threshold, rules that produced the pair (or "added by vendor")                     | Pending and failed shown explicitly                                            |
| `/sandbox`                    | Every screen above (dashboard to pair inspection) on one prepared evaluation, read-only, no login; banner "Sandbox · fictional data · read-only. Judgments recorded from Jev \<model\> on \<date\>" | —                                                                              |

**Visual references wanted** for field mapping, the rules builder, the
category summary with the pairs table, and the side-by-side diff. They
should aim for dense but readable tables and a calm, neutral look.

## Milestones

Order: M0 → M1 → M2 → M3 → M4. Each milestone passes `local-review` before
its push, and each branch commits its schema, migrations and session logs
together.

| Branch                           | What it delivers                                                                                                                                                                                                                                                                                                                                      | Acceptance                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** `docs/product-plan`       | The scope doc and this plan, linked from `AGENTS.md`                                                                                                                                                                                                                                                                                                  | Merged                                                                                                                                                                                                                                |
| **M1** `feat/jev-vertical-slice` | 1. `typesafe.ts`, the tracking extension, and a `pnpm jev:check` live script on fictional pairs (prints shape, latency and model, never record content). 2. The full schema with migrations and RLS. 3. Sign-in/up and `requireUser`. 4. A rough but real flow: create → upload with basic mapping → email rule → real Jev run → basic category table | A live call returns a documented `noul` and gets a tracking row. The demo CSVs show all four categories end to end. A second user gets 404. We record: pinned model accepted or not, repeatability, 429 behavior, threshold evidence. |
| **M2** `feat/evaluation-setup`   | Mapping UI, every validation state, completeness confirmation, rules builder with normalization, plan preview, limits and bucket warnings                                                                                                                                                                                                             | Invalid references, duplicates and over-limit plans are blocked with clear errors. Counts are correct. Vendor pairs outside blocking appear in the plan.                                                                              |
| **M3** `feat/run-and-results`    | Retries, stale-claim reclaim, config error, retry failed, resume, reuse across runs, threshold control, dashboard, filters, inspection                                                                                                                                                                                                                | A forced failure stays incomplete and retry succeeds. A threshold change recomputes without calling Jev. A disagreement can be inspected.                                                                                             |
| **M4** `feat/sandbox`            | Fictional dataset, prepared snapshot, idempotent `pnpm demo:seed`, public read-only `/sandbox` (replaces the planned `/demo`), landing entry points, e2e with a Jev stub, manual checklist                                                                                                                                                            | Friday gate: `local-review`, e2e and the manual flow all pass                                                                                                                                                                         |
| Optional                         | Up to 3 vendors with vendor tabs                                                                                                                                                                                                                                                                                                                      | Only once the Friday gate is green                                                                                                                                                                                                    |

**Cut line if time runs short:** drop multiple vendors first, then the
landing page, then the plan's reduction statistic. Never cut the loop,
inspection, save/reopen or the sandbox.

## Verification

**Unit tests** (`node --test`, pure domain code):

- **CSV:** BOM, quoted commas and newlines, missing or duplicate
  references, limits
- **Normalization:** email, phone with country, name, postcode
- **Blocking:** overlapping buckets; blanks never share a bucket; bucket
  warnings
- **Pairs:** canonical order, reversed pairs collapse, no self-pairs,
  dedupe across buckets and vendors, vendor pairs outside blocking
  included, group expansion n(n−1)/2
- **Limits:** the cap explanation; vendor pairs never dropped
- **Decisions:** the `≥` boundary, all four categories, failed and pending
  never categorized
- **Judgment key:** a threshold change doesn't change the key
- **Jev parsing:** a missing or out-of-range `noul` becomes `failed`
- **Retries:** 429 and 529 retry; 401 is a config error; 422 fails

**E2E (Playwright):**

- A local Jev stub is used via a `TYPESAFE_BASE_URL` override, so CI needs
  no key. It returns scripted scores, one 529-then-success and one
  permanent failure.
- The flow: sign up → upload → rules → plan counts → run → categories →
  inspection → retry failed; plus the public demo; plus a two-user
  isolation check.

**Manual:** the live flow with the real key on fictional data, and a check
that no record content reaches logs, analytics or `ai_usage`.

## Demo scenario

About 24 fictional people, Vendor A as a pair CSV, and rules Email, Phone,
and Last name + postcode.

| Case                                                                         | Vendor A               | Expected category                  |
| ---------------------------------------------------------------------------- | ---------------------- | ---------------------------------- |
| Same person, email case and phone format differ                              | Matched                | Both matched                       |
| Misspelled surname, same email and date of birth                             | Missed                 | PairSight only                     |
| Relatives sharing a phone and address, different first names and birth dates | Matched                | Vendor only                        |
| Common name and postcode, different birth date and email                     | Not matched            | Neither matched                    |
| Same person who moved (new email, phone and postcode)                        | Matched, outside rules | Both matched, **outside blocking** |
| Two unrelated people                                                         | Matched, outside rules | Vendor only, outside blocking      |
| Nickname with a missing birth date                                           | —                      | Low-confidence flag                |
| Blank emails or phones                                                       | —                      | No giant blank bucket              |

These are designed expectations. Run real Jev on the dataset and adjust
the fixtures until every category is populated. The prepared snapshot is
a real run, with its model id and date. Failures are demonstrated in the
stubbed e2e, not in the demo data.

## Roadmap

| Feature                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | When                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Login, saved evaluations, upload/validation/mapping, pair and group CSVs, identity and blocking, the match threshold in Rules, plan preview, Jev runs with progress and retry (the Runs centre), comparison, inspection, up to 3 vendors, delete an evaluation, qualified metrics (AI-estimated, evaluated pairs only), the sandbox, a polished landing, fuzzy blocking with derived rule fields, CSV and Excel import and findings export, the PDF summary report, people, organisations and products (type detected from the file, a larger field dictionary) | Built (M1–M4, October 2026) |
| Human review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Next                        |
| Analytics events                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Next                        |
| Background worker, rule suggestions learned from past runs, vendor-specific adapters, legacy `.xls`, sampling excluded pairs, verified ground-truth labels, more entity types, larger scale                                                                                                                                                                                                                                                                                                                                                                     | Deferred                    |
| Live deployment: on-premises, with Jev on the customer's own infrastructure, so their data never leaves it                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Deferred                    |

The scaling work (background worker, results from the database, large
uploads, Jev throughput, Splink, automatic pair selection) is ordered and
explained in [`PairSight-Scale-Roadmap.md`](PairSight-Scale-Roadmap.md).

## Risks to check early (M1)

1. **Jev access and behavior:** the key, the response shape, whether a
   pinned model is accepted, latency, 429s at concurrency 4, and
   repeatability.
2. **Jev's judgment on our wording:** relatives, and the default threshold.
3. **AI tracking fit:** pricing for the `decisions` output type and
   `check:ai-models`.
4. **CSV variety:** Excel exports (BOM, quotes, CRLF).
5. **Pair explosion:** counts and caps before every run.
6. **Dev-server restarts mid-run:** handled by stale reclaim (M3).
7. **Data leaks between users:** owner-scoped data access and a two-user
   e2e.
8. **Friday timing:** the cut line, and M1 being a real end-to-end slice.
