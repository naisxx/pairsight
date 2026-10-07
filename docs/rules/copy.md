# Copy: plain English, one word per thing

Every word a person reads in PairSight — screens, toasts, errors, the
downloads and the PDF report — lives in `messages/en.json` (a handful of
error pages and server messages excepted, listed below) and follows this
file. `src/i18n/copy.test.mts` fails the build when a retired word comes
back.

## Who we write for

An analyst whose boss asked them to pick a matching vendor. Smart, busy,
and new to record matching: they have never heard of blocking, buckets or
an F1 score, and they shouldn't need to. If a sentence only makes sense to
someone who built PairSight, rewrite it.

## How it sounds

- **Two people talking.** Write it the way a helpful colleague sitting
  next to the analyst would say it out loud: ask, answer, explain. Put
  what we need as a question ("What should we call you?", "Which column
  gives each record its own ID?", "How sure must Jev be?"), say what we
  did ("These look like people to us"), and reassure where it helps
  ("Nothing's sent until you press Start run"). Contractions are fine;
  formality isn't the goal. Buttons and short labels stay short and plain
  ("Start run", "Next: vendors").
- **Second person, plain verbs.** "Upload your records", not "Source
  dataset ingestion".
- **Say why.** Every step intro and every input says what we need, why we
  need it, and what it changes for you. "Vendor files point to records by
  this ID, so we can line their matches up with yours."
- **Give the consequence, then an example.** "The match cut-off decides
  which pairs count as the same (for example, 0.62 lets more through than
  0.80)."
- **Errors say what happened and what to do**, in the reader's terms —
  never a variable name, a command, an HTTP status or a stack of jargon.
  The technical cause goes to the logs (`docs/rules/logging.md`) and
  `captureError`, not the screen.
- **Agreement, not correctness.** Jev is an AI, not the truth. Copy says
  "Jev says they're the same", never "they are the same" or "the vendor
  was wrong".
- House style: British spelling (organisation, centre), curly apostrophes,
  `·` as a separator. No maths symbols in prose (≥, ±, ∅): write "at or
  above", "within 0.10 of", "missing".

Strings to imitate: `Welcome.description`, `Records.noReference`,
`Overview.precisionTip`, `Report.headToHeadIntro`.

## One word per thing

| Thing                                    | Say                                                                                      | Don't say                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The AI that checks pairs                 | **Jev** — introduced once per screen: "Jev, the AI that checks each pair"                | PairSight (as the judge), PairSight (AI), AI judgment, the reference |
| What Jev gives a pair                    | **Jev's score** (0 to 1: how sure it is they're the same); **Jev says same / different** | assessment, judgment, decision (for Jev), verdict                    |
| Doing that                               | **check**                                                                                | assess, evaluate, judge                                              |
| Two records that might be the same       | **pair**; **pairs to check**                                                             | candidate, planned / evaluated / assessed pairs                      |
| The pairs PairSight picks to check       | **pairs PairSight suggests**; on a pair, **Suggested by PairSight**                      | blocking, comparison rules, your own rules, presets, composite       |
| A pair added because a vendor matched it | **Added because a vendor matched it**                                                    | vendor-only pair, outside the rules                                  |
| Records that share a value               | **group**                                                                                | bucket, key                                                          |
| A similar, not identical, value          | **close match**                                                                          | fuzzy, derived, looser key                                           |
| What counts as the same                  | **what counts as the same**                                                              | identity, identity instructions, definition                          |
| The score a pair needs to be a match     | **match cut-off** (how sure Jev must be)                                                 | threshold, decision threshold                                        |
| The project                              | **evaluation**                                                                           |                                                                      |
| One round of Jev checking pairs          | **run**; the button is **Start run**                                                     | "Start evaluation"                                                   |
| What a vendor gives you                  | **vendor file**: **a list of pairs** or **a list of groups**                             | export, match export, pair format, group format                      |
| What PairSight gives you                 | **download**                                                                             | export                                                               |
| Your own data                            | **your records**                                                                         | source records, dataset, source file                                 |
| The column that identifies each row      | **ID column**, **record ID**                                                             | reference, record reference                                          |
| Saying which column holds what           | "tell us which column holds what"                                                        | map, mapping, role, PairSight field                                  |
| Work not finished                        | **not checked yet**, **couldn't check**                                                  | pending, incomplete, provisional, partial                            |
| Precision                                | **Correct merges** (tip: "also called precision")                                        |                                                                      |
| Recall                                   | **Duplicates found** (tip: "also called recall")                                         |                                                                      |
| F1                                       | **Overall score** (tip: "also called F1")                                                | harmonic mean                                                        |

The technical names (precision, recall, F1, match cut-off as
"threshold") appear only in hover tips and the PDF glossary, so an
analyst can still line our numbers up with a vendor's sales sheet.

## The result groups

Named for who says what — never for who is right:

| Group                 | Means                                             |
| --------------------- | ------------------------------------------------- |
| Both say same         | The vendor and Jev agree these are the same       |
| Only Jev says same    | A duplicate the vendor may have missed            |
| Only vendor says same | A merge the vendor may have got wrong             |
| Both say different    | The vendor and Jev agree these are different      |
| Not checked yet       | Jev hasn't checked it, or couldn't; never counted |

The keys and URL values stay `both_matched`, `pairsight_only`,
`vendor_only`, `neither_matched`, `incomplete` — they're a contract with
links and downloads, not words anyone reads.

## Numbers

Every count is written one way (`src/i18n/formats.ts`): three significant
figures, with K and M from a thousand: 999, 1.2K, 12.3K, 1.23M. A bare
"1200" or "1,234,567" is hard to read at a glance, and runs get big fast.
The exact figure is never lost: hovering a shortened count shows it.

- In messages, a count is `{count, number, compact}`, plural branches
  included (never `#`). `src/i18n/counts.test.mts` fails otherwise.
- In components, a count on its own is `<Count value={n} />`
  (`src/components/ui/count.tsx`), exact on hover. A sentence whose count
  is the point gets the exact sentence on hover with `exactTitle`. Lint fails
  on `format.number(n)` without a named format and on `toLocaleString()`.
- Not counts, so not shortened: shares (80.0%), scores and cut-offs (0.62),
  money, dates, page numbers, run numbers and IDs.

## Never name the tech behind a feature

Screens say what PairSight does, not what it's built with. No library,
service or method names anywhere a user can see them: no "Splink", "DuckDB",
"Fellegi–Sunter", "match weight", "model" or "EM", in copy, tips, file
names, downloads or the PDF. Pairs PairSight picks by itself are
**suggested by PairSight**; what they share is said in plain words ("the
same date of birth", "first and last names swapped"). Code, ids and docs may
keep the real names (`'splink'` among a pair's reasons, `services/splink`).
`src/i18n/copy.test.mts` fails on the names, and on "comparison rules",
"close-match rules" and "your (own) rules": PairSight picks the pairs, so
there are no rules to set.

## Outside the catalog

A few messages are written where they're raised rather than in
`messages/en.json`, and follow the same rules: `AppError` messages in
`src/server/**` that reach a toast or form, the error pages
(`src/app/[locale]/error.tsx`, `src/app/global-error.tsx`,
`src/components/error-boundary.tsx`) and `src/lib/errors/normalize-error.ts`.
