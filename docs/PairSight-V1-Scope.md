# PairSight v1 — scope and domain rules

The product vision, user journey and score definitions live in
[PairSight-Product-Overview.md](PairSight-Product-Overview.md). This file
records the decisions engineering must hold to. Status: decisions are
agreed, and there is no product code or delivery plan yet. The target is a
first stable loop by **Friday 2026-10-02**; the build sequence is in
[PairSight-Delivery-Plan.md](PairSight-Delivery-Plan.md). All numeric limits are initial
defaults, to adjust after a real Jev integration test.

## Scope

**Confirmed v1 loop**

1. Upload source records and vendor results, and map their fields.
2. Define identity and overlapping blocking rules.
3. Combine blocked candidates with every vendor-matched pair, removing
   duplicate pairs.
4. Evaluate each unique pair with Jev and apply our decision.
5. Compare decisions per vendor as **both matched**, **PairSight only**,
   **vendor only** or **neither matched**, and inspect each pair.

**Before Friday, in priority order:**

1. The upload-to-comparison loop.
2. Pair inspection: both records, the vendor decision, Jev's output and the
   PairSight decision.
3. Minimal save and reopen.
4. Repeatable fictional demo data.

**Access:** login is required to create a real saved evaluation or to run
Jev. The demo can be explored before login, using clearly labeled prepared
results.

**Later:** human corrections, precision/recall/F1, polished exports, an
elaborate landing page, fuzzy name matching, and the uncertain category.

## Limits (configurable)

| Limit                          | Default                                                   |
| ------------------------------ | --------------------------------------------------------- |
| Source records                 | 500                                                       |
| Vendors                        | 1 required end to end; up to 3 if the core flow is stable |
| Unique evaluated pairs per run | 5,000                                                     |
| Bucket size warning            | > 50 records (shows the bucket's pair count)              |
| Import format                  | CSV only                                                  |

Check the limits **before any Jev call**. If the combined pair set exceeds
the cap, explain which rules or vendors caused it and ask the user to
reduce the input or tighten blocking. **Never silently drop vendor pairs.**
The bucket warning is about workload, not accuracy.

## Inputs and validation

- **Source records:** a CSV with a unique record reference. Missing or
  duplicate references block the user from continuing. Keep the original
  values for inspection; normalized copies are only for blocking.
- **Vendor exports:**
  - The standard pair CSV comes first. A standard group CSV comes next if
    time permits.
  - A group of _n_ records means all n(n−1)/2 unordered pairs. De-duplicate
    group members and the pairs they produce. Flag large expansions before
    a run.
  - An unknown record reference is a validation error: show the affected
    rows and require a correction before evaluation.
- **Completeness:**
  - An export lists positive matches only. A pair it omits means the vendor
    didn't match it, **but only if the export is complete**.
  - Explain this at upload and require the user to confirm the export is
    complete. Reject exports that aren't confirmed; never treat unknowns as
    nonmatches.
  - Every vendor must have evaluated the same source dataset and identity
    objective.

## Blocking

- Rules use exact equality on normalized values, and multiple rules combine
  with OR. A rule is one field or a composite key.
- Starter rules and their normalization:
  - **Email:** trim and lowercase. Keep dots and `+tags`.
  - **Phone:** normalize consistently using an explicit country context.
  - **Name:** trim, lowercase and collapse whitespace.
  - **Name + postcode or location:** a composite rule.
- A record with a missing value for a rule isn't bucketed by that rule, so
  blanks never form one giant shared bucket.
- Blocking only proposes pairs worth checking. It never decides that two
  records match.

## Pairs and categories

- **A pair** is two different records, unordered, stored with its
  references in canonical order. Self-pairs are never created.
- **The comparison set** is the blocked pairs ∪ every vendor-matched pair,
  with each pair appearing once. Vendor pairs outside the blocking rules are
  always included.
- **Vendor decision** for each pair in the set: _matched_ if the confirmed
  complete export links the two records, otherwise _not matched_.
- **Each pair's evaluation status** is `pending`, `succeeded` or `failed`.
  Only a succeeded evaluation gets a PairSight decision.
- **Categories** are assigned per vendor, per succeeded pair:

  | Vendor ↓ / PairSight → | match          | no match        |
  | ---------------------- | -------------- | --------------- |
  | matched                | Both matched   | Vendor only     |
  | not matched            | PairSight only | Neither matched |
  - They measure **agreement, not correctness**. "Vendor only" can be a
    vendor mistake or a PairSight mistake.
  - Pending and failed pairs get **no category** and are never treated as
    nonmatches. They're shown and counted as incomplete.
  - Pairs outside the set are unassessed. Statements about missed
    duplicates cover the evaluated set only.

## Runs and reuse

- **Each run freezes** the source records, identity definition, blocking
  configuration, vendor inputs and comparison set. Completed runs stay
  reproducible.
- **Changing the source data, the identity definition, or Jev's
  model/request configuration** means a new run with new assessments.
- **Changing blocking rules or adding a vendor** also means a new run, but
  it reuses successful assessments whose records and judgment
  configuration are identical. Only newly introduced pairs go to Jev.
- **Changing only the threshold** recalculates decisions from the saved
  scores, without calling Jev again.

## Jev

Jev is TypeSafe's hosted "System One" decision model. We call it from the
server through `src/server/ai/` with AI usage tracking. The request contains
only the two records' mapped identity fields and the user's definition of
"same individual": never vendor names, scores, decisions or record
references.

**Verified from documentation** (checked 2026-09-30):

- **Access paths:**
  - TypeSafe's own API: `POST https://api.typesafe.ai/v1/systemone`, model
    `jev-latest`, Bearer auth.
  - OpenRouter: `POST https://openrouter.ai/api/alpha/decisions`, model
    `typesafe/jev-1.13`. Its responses report the dated
    `typesafe/jev-1.13-20260917` and include `usage.cost`.
  - Sources: [TypeSafe API](https://docs.typesafe.ai/api) and the
    [OpenRouter community guide](https://openrouter.ai/docs/guides/community/jev-tutorial).
- **Request:** `state` (a string, object or array) plus named `questions`.
  A yes/no `noul` question has `instructions` and optional
  `criteria.true` / `criteria.false`.
- **Output:** `{"type": "noul", "noul": p}`, where `p` (0–1) is the
  probability that the answer is yes. TypeSafe says it's calibrated across
  groups of predictions, not a guarantee for any single answer
  ([Noul](https://docs.typesafe.ai/primitives/noul),
  [confidence](https://docs.typesafe.ai/confidence)).
- **Errors:** 401, 422, 429 (rate limit) and 529 (overloaded). Retry
  429/529 with exponential backoff.
- **Price on OpenRouter:** $0.042 per million prompt tokens and $0 for
  completion. About $0.00002 per ~500-token call, so a 5,000-pair run costs
  roughly $0.10. Cost doesn't argue for a lower pair cap; rate limits might.
- **Data:** TypeSafe's
  [privacy policy](https://typesafe.ai/privacy) says it doesn't train on
  input and that services are hosted in the US. It doesn't cover API
  logging or retention, and no DPA was found.

**Decisions:**

- **Access:** TypeSafe's own API (`api.typesafe.ai/v1/systemone`), not
  OpenRouter. The key is available; add it to `.env.local` when the
  integration starts, and name it then in `src/lib/env.ts` and
  `.env.example`.
- Jev returns a documented score (`noul`), so the threshold is
  user-configurable. Recommend a default only after testing fictional
  pairs. TypeSafe's guidance is 0.5 when both errors cost the same, and
  higher when a false "yes" (merging different people) is costlier.
- Low-confidence scores can be flagged for inspection. That flag is not a
  category.
- If a response carries no documented score, record the pair as `failed`
  and never invent one.
- **One pair per request,** so a failure only affects that pair.
- Jev is not deterministic (verified: about ±0.01 between runs). Store
  each assessment with the model id and
  version Jev reports, and when it ran.

## Personal data

- The trial and demo use fictional or appropriately anonymized records
  only. No real identifiable customer data goes to Jev until TypeSafe's
  data handling and our authorization are established.
- Records and results live in local Supabase, through Prisma.
- Uploaded records, pair contents and credentials never go into agent logs,
  analytics, AI usage `meta` or error reports.
- Deleting an evaluation deletes its uploads, runs, assessments and
  results. Don't keep temporary upload copies after parsing. Don't claim
  that Jev-side data is deleted without evidence.

## How it fits this repo

- **Data:** new tables need a locally generated migration plus an RLS
  migration (`docs/rules/migrations.md`).
- **Auth:** Supabase Auth is wired, but there's no sign-in UI yet, nothing
  calls `provisionUser`, and there's no session or ownership guard for
  ordinary users. The `src/lib/rbac/` guards are admin-only. Every
  evaluation query must be scoped to its owner (`docs/rules/auth.md`).
- **AI tracking needs extending for Jev:**
  - `pricing.ts` only fetches models whose output is text, embeddings or
    transcription. Jev's output is `decisions`.
  - `typesafe/jev-1.13` isn't in OpenRouter's public `/models` list; only
    `typesafe/jev-router` is, with prices of `-1`.
  - The direct API returns token usage but no cost, and TypeSafe doesn't
    publish its own price. Decision (2026-09-30): price Jev rows at
    OpenRouter's rate for `typesafe/jev-1.13` as a stand-in, until
    TypeSafe's own price is known.
  - As things stand, Jev calls would be logged with a NULL cost and
    `check:ai-models` would fail. The `ai_usage` columns stay unchanged
    (they're a cross-repo contract).
- **Dependencies approved (2026-09-30):** `libphonenumber-js` for phone
  normalization and `papaparse` for CSV parsing.

## Verified live (pnpm jev:check, 2026-10-01)

- **Model:** `jev-1.13.0` is accepted and reported back, so the app pins it
  (`JEV_MODEL`). Plain `jev-1.13` is rejected as unknown (HTTP 400), and
  `jev-latest` currently resolves to `jev-1.13.0`.
- **Response:** `{ model, answers: { <id>: { type: "noul", noul } }, usage:
{ input_tokens, output_tokens } }`, as documented. There's no request id.
- **Speed and limits:** about 300–450 ms per call. Four concurrent calls
  returned 200 with no 429s; the exact rate limit is still unknown.
- **Not deterministic:** the same pair scored 0.91, 0.90 and 0.91, and
  other pairs moved by about ±0.01 between runs. Store the score from each
  assessment; never assume a re-run reproduces it exactly.
- **Default threshold 0.5, low-confidence band ±0.1 (kept).** On the
  fictional pairs, likely-different people scored 0.01–0.11 and likely-same
  people 0.76–0.98, so 0.5 sits in a wide gap. The band is far wider than
  the run-to-run noise.
- **Cost:** about 510 input tokens per pair, about $0.00002 at the stand-in
  rate, so a 5,000-pair run costs about $0.10.

## Still open

1. **Rate limit:** not documented, and not hit at concurrency 4. The
   engine retries 429 with backoff if it appears.
2. **Request size limits:** not documented. Not a concern for one pair per
   request.
