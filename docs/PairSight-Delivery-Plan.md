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

**Run execution: a client-driven loop over work claimed in the database.**

- **Starting a run** freezes a snapshot and creates the run's pairs and any
  missing pending assessments.
- **The run page** repeatedly calls `advanceRun`, which:
  - claims a batch of 10 pending assessments, plus any "running" ones older
    than 60 seconds (reclaimed after a crash or hot reload)
  - calls Jev with concurrency 4 and a 20-second timeout
  - retries 429, 529, timeouts and network errors up to 3 times with
    backoff
  - marks 422 and unparseable responses as `failed` straight away
  - stops the run on 401, as a configuration error
  - returns progress counts
- **Closing the page pauses the run**; reopening resumes it.
  **Retry failed** resets failed pairs to pending.
- **Why not a background worker:** `after()` only lasts the route's maximum
  duration, and a queue is infrastructure we don't need on localhost. A
  background worker is deferred.

**Data model** (`prisma/schema/pairsight.prisma`; every table gets an RLS
migration):

| Model                | Key fields                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Evaluation`         | `ownerId?` (null for the demo), `name`, `kind` (live or demo). Draft configuration: `identitySame`, `identityDifferent`, `countryCode`, `jevFields[]`, `blockingRules` (JSON), `threshold`                        |
| `SourceDataset`      | `evaluationId`, `fileName`, `rowCount`, `referenceColumn`, `columnRoles`. Immutable: replacing the file creates a new dataset.                                                                                    |
| `SourceRecord`       | `datasetId`, `reference` (unique per dataset), `rowNumber`, `values` (original values, JSON)                                                                                                                      |
| `VendorExport`       | `evaluationId`, `datasetId`, `name`, `format` (pair, later group), `mapping`, `confirmedCompleteAt`, `pairCount`                                                                                                  |
| `VendorMatch`        | `exportId`, `recordAId`, `recordBId` (canonical order, unique)                                                                                                                                                    |
| `Run`                | `evaluationId`, `datasetId`, `number`, `origin` (live or prepared), `status`, and a frozen snapshot: identity definition, `jevFields`, country, rules, `exportIds[]`, `judgmentKey`, requested model, `threshold` |
| `RunPair`            | `runId`, `recordAId`, `recordBId`, `ruleIds[]`, `matchedByExportIds[]`, `assessmentId`                                                                                                                            |
| `Assessment`         | `datasetId`, record A/B, `judgmentKey`, `status` (pending, running, succeeded or failed), `score?`, `modelReported`, `requestId`, `attempts`, `errorCode`, `claimedAt`, `completedAt`, `origin`                   |
| `HumanReview` (next) | `runPairId`, `reviewerId`, `verdict` (same, different or unsure), `note`. Kept separate from AI judgments.                                                                                                        |

- **Reuse:** `judgmentKey` is a hash of the identity definition,
  `jevFields`, country, requested model and request-template version. The
  threshold isn't part of it. Assessments are unique per (dataset, pair,
  key), so a new run reuses succeeded assessments and only sends new pairs
  to Jev.
- **Categories are computed when read**, from the run's threshold and
  `matchedByExportIds`, so a threshold change never calls Jev.

## v1 choices

- **Source CSV:** UTF-8, BOM allowed, header row, comma-delimited, ≤ 1 MB
  (under Next's 1 MB server-action limit), ≤ 500 rows. An empty cell is
  missing. The reference is trimmed, required and unique; errors list row
  numbers.
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
  - A pair is a match when `noul ≥ threshold`. The threshold is editable
    on the results page.
  - The default comes from the M1 test (0.5 until then).
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
| Workspace `/evaluations/[id]` | Stepper: Records → Vendors → Rules → Plan → Run → Results                                                                                                                                           | Each step: complete or needs attention                                         |
| Records                       | Upload, preview of the first 10 rows, reference column, role per column                                                                                                                             | Parsing; file errors; missing or duplicate reference table; success            |
| Vendors                       | Name, file, A/B columns, completeness checkbox, vendor list                                                                                                                                         | Unknown-reference table; self-pair and duplicate counts                        |
| Rules                         | Identity text areas, country, fields sent to Jev, rules with live counts                                                                                                                            | Warning above 50 records per bucket; no-rules state                            |
| Plan                          | Pair counts by source, pairs outside blocking, reduction, reused assessments, limit check, **Start evaluation**                                                                                     | Over-limit block with its cause; open validation errors block starting         |
| Run                           | Progress and counts; note that the run pauses if the page is closed                                                                                                                                 | Running, paused/resume, config error, failures with **Retry failed**, complete |
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

| Feature                                                                                                                                                                                   | When                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Login, saved evaluations, upload/validation/mapping, pair CSV, identity and blocking, plan preview, Jev runs with progress and retry, comparison, inspection, prepared demo, bare landing | Before Friday                                                                 |
| Multiple vendors (up to 3)                                                                                                                                                                | Before Friday if stable, otherwise next                                       |
| Group CSV, delete an evaluation (required before any real data), human review, CSV findings export                                                                                        | Next                                                                          |
| Qualified metrics (precision on evaluated vendor pairs; recall and F1 labeled "evaluated set only"), summary export, polished landing, analytics events                                   | Next                                                                          |
| Background worker, fuzzy blocking, vendor-specific adapters, XLSX, sampling excluded pairs, verified ground-truth labels, other entity types, larger scale                                | Deferred                                                                      |
| Real customer data                                                                                                                                                                        | Deferred until TypeSafe's data handling and our authorization are established |

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
