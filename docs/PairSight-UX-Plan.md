# PairSight UI/UX plan

Approved 2026-09-30. The design reference for every PairSight screen;
build order follows [PairSight-Delivery-Plan.md](PairSight-Delivery-Plan.md).

> **Updated 2026-10-02 — the UI was rebuilt to a finished design.** The
> section below, _What shipped_, is the current reference for every screen
> and for how each open question was settled. The numbered sections after it
> are the original plan: the journey, states and principles still hold, but
> where they describe a layout, a size or a component that the shipped
> section contradicts, the shipped section wins. Tokens, type roles and
> spacing are in [`DESIGN.md`](../DESIGN.md).

## What shipped (UI revamp, October 2026)

The whole app was rebuilt to a finished design. Behaviour stayed ours
(picking pairs, mapping, validation, runs, gating); the look, layout, copy and
motion follow the design. Human review is **not built**: anything of it in
the design is hidden until it is. The demo
became the Sandbox (below).

**Shell.** A 256 px sidebar on the page canvas (60 px collapsed, a 280 px drawer on phones,
toggled with `[` and remembered in a cookie) holds the Evaluations link, the
current evaluation's name and a numbered pipeline (done, active, next,
locked — a locked step says why). A 52 px top bar shows the breadcrumb and
the evaluation's status chip. Pages are a centred column (1280 px; 1440 px
for Results and Pair) that scrolls inside `<main>`, with an action bar docked
to its bottom: Back on the left, the primary action on the right and the
reason it's blocked beside it. A locked step can't be opened by URL either:
it redirects to where the evaluation is up to.

**Screens.**

- **Landing (`/`, signed out only)**:
  - A floating nav: a link to each section (the current one marked), the
    theme menu, Sign in and Try the demo, with a scroll progress bar.
  - A hero with an interactive results panel on the demo's real recorded
    run (`prisma/demo/sandbox-snapshot.json`): switch vendor, move the
    match cut-off and the scores, the four counts and each pair's label
    recompute with the same functions as Results; open a pair to see what
    differs, Jev's score and what the vendor said.
  - How it works: pinned while you scroll on wide screens, following one
    real pair (R01 and R03, a duplicate both vendors missed) from the files,
    through the rules, to the verdict. A plain list on narrow screens or
    with reduced motion.
  - A closer look (three cards), Who it's for, Honest about what it
    measures (with "Your data"), and a short FAQ.
  - A band of the demos' real numbers in coral (pairs Jev judged, records
    per demo, record types), under the hero.
  - A closing full-coral band with the demo's head-to-head beside it, and a
    four-column footer.

  Signed in, `/`, `/sign-in` and `/sign-up` go to `/evaluations`.

- **Sign in / Sign up / Welcome** — one column, the form in a card; fields
  are checked once submitted (then as you type), never on blur; a show/hide
  password toggle. Welcome asks for a full name (required, ≤ 100) before the
  app opens.
- **Evaluations** — a greeting, a summary strip, the latest finished run's
  precision/recall/F1 per vendor, Continue setup with stage bars, and a
  searchable table with Open / Rename / Delete; each row says what its
  records are (People, Organisations, Products). Names are unique per
  account, ignoring case.
- **Records** — drop zone (CSV or Excel `.xlsx`; a workbook with more than
  one sheet of data shows a sheet picker, and the file bar names the sheet
  read); then **what the records are**: people, organisations or products,
  read from the column names and sample values ("These look like
  organisations") and confirmed with three radio cards, or asked when the
  file is ambiguous. The type decides the fields to map, how PairSight
  suggests pairs and what Jev is asked; switching it suggests that type's
  fields. A file under 200 records is refused with a plain message ("The
  file has N records. PairSight needs at least 200 to learn what a
  duplicate looks like…"); the upper limit is 10,000.
  Then each of the type's fields mapped to one of your
  columns (suggested from a large dictionary of CRM, ERP and commerce column
  names, backed by the values: emails, websites, barcodes; with sample values), a Validation panel checking
  references as you choose, and a 10-row preview. Continue saves and goes to
  Vendors. Once saved the dataset is read-only; Replace file asks first.
- **Vendors** — a vendor list beside an editor. Each vendor is a draft until
  confirmed complete; it can be renamed or removed. Drop the file and
  PairSight works out pair or group format and the columns from your records'
  references ("Read as …", with Change to override). Group exports expand to
  every pair in each group. Unknown references block, with row numbers.
- **What Jev checks** (the `rules` step; route and stage key unchanged) —
  what counts as the same (both definitions required), the values Jev sees
  (at least two), the country by name, and the **match cut-off**: Lenient
  0.35 / Balanced 0.50 / Strict 0.70, or a value of your own from 0.01 to
  0.99. It's decided before any results are seen, and the next run keeps
  it. Changes save themselves; invalid ones are held back with the reason.
  Each save shows "Saved" with **Undo** for 10 seconds; edits made close
  together undo as one, back to before the first. Each definition offers
  **Use the suggested wording** (the record type's own) once it differs
  from it, undoable the same way. Replacing the records with another type
  swaps in that type's wording only if yours was still the old default:
  your own wording is never thrown away unasked. If the last change can't
  be saved as you leave, a toast says so on the next page.
  Laid out as four cards in two aligned rows (what counts as the same and
  the country | the cut-off, as a big number with its presets and scale;
  the pairs Jev will check | what Jev sees), each row one height. **The
  pairs Jev will check**: how many pairs PairSight
  suggests, what they share ("the same date of birth", "the same company
  number", "the same barcode"), and how many of each vendor's pairs they
  already include, drawn as bars. There are no rules to set: the hand-written comparison
  rules, their presets, close-match keys and the Advanced section shipped
  in v1 and were replaced by suggestions (Scale Roadmap items 6, 10 and
  11), along with the suggestions switch and the hard-cases readout on
  Results and in the PDF.
- **Copy** — every screen is written for an analyst new to record
  matching, per `docs/rules/copy.md`: each step says what it needs, why,
  and what it changes; one word per thing (Jev, pairs to check, Suggested
  by PairSight, match cut-off, vendor file, download); precision, recall and F1
  appear as Correct merges, Duplicates found and Overall score, with the
  technical names in hover tips and the PDF. The result groups say who
  says what (Both say same, Only Jev says same, Only vendor says same,
  Both say different, Not checked yet), never who is right. The sandbox
  is called the demo on screen. Step pages have their own tab titles.
  `src/i18n/copy.test.mts` fails on the retired jargon.
- **Plan** — headed "Jev will check N pairs." with the number in coral. "From
  records to pairs" is drawn, not listed: four numbers in a row (your
  records → possible pairs → pairs Jev will check → new checks, with the
  cost and time), then two bars: where the pairs come from (PairSight's
  suggestions plus every vendor pair, overlap counted once) and what's
  reused from earlier runs. Under it, the cut-off the run will keep (big
  number on Jev's scale, with Change) and what Jev sees (the values as
  chips, and that it never sees the vendors' decisions). Detail sits in
  hover tips. A notice covers unfinished vendors. Start
  run runs it. What can hold it back:
  - **Still suggesting:** Start waits while PairSight works out the pairs.
  - **Suggestions failed** (scoring failed, or the service isn't set up):
    the Plan says so with a **Try again** button that queues the scoring
    again. There's no fallback.
  - **Too few records:** an old dataset saved before small files were
    refused.
  - **Over the limit (100K pairs):** only suggested and vendor pairs can
    get there (each vendor file is capped at 100K itself), so the alert
    shows where the pairs come from (suggested, vendor-only) and links to
    change the records or the vendor files.
- **Runs centre** (replaces the Run step; the pipeline is now Records →
  Vendors → What Jev checks → Plan → Results). A dialog opened from **Runs** in the top
  bar on every app page, with a spinner and a count while something runs.
  - **Contents:** every run across your evaluations, in two tabs. Active is
    the default while something runs, otherwise Completed. Completed holds
    finished runs, runs finished with failures (Retry failed on the card),
    stopped runs (a red card with the reason, the fix and Resume), and
    paused ones (a quiet card: "You paused this run", with Resume).
  - **Cards:** the front shows run and evaluation, status, live progress or
    pairs and threshold, and the one action that matters. Details expand to
    everything the run was run with: the cut-off and its name (Lenient,
    Balanced, Strict), judgments reused and new, why pairs failed, Jev
    model, vendors and files, fields,
    country, identity text, times and the run ID.
  - **Starting a run:** Start opens the centre on Active. On completion the
    run moves to Completed and you're taken to its results. Closed early,
    the run keeps going and a toast offers its results when it's done.
  - **Running:** a background worker on the server checks the pairs, so a
    run keeps going with no page open. The centre only watches progress,
    and notices runs started in another tab. **Pause run** on a running
    card stops it after the pairs in flight; Resume carries on.
  - **Old Run page links** redirect to the run's results with the centre
    open on it (`?runs=<id>`).
- **Results** — a header that answers first: the run's status and meta,
  then the verdict in its own card on a coral wash ("Atlas Resolve scores
  higher overall: 78.6% vs 70.9%"; under 2 points apart, as shown, "Clearline
  Resolve and Northwind Match are close overall: 81.2% vs 80.0%", and the
  PDF says the lead is "only just"; a tie or a single vendor's score said as
  such; under it how often each agreed with Jev, each out of its
  own checked pairs, with a tip on what "agreed" counts; a caveat;
  **Look at the disagreements**; a drawn pair of records).
  - **One ranking everywhere:** vendors rank by Overall score (F1), with
    Correct merges breaking a tie (`src/lib/pairsight/ranking.ts`). The
    headline, the "Best overall" pill, the dashboard's latest result, the
    landing and the PDF all use it, so they never name different leaders.
    The cards on the Overview and the dashboard's table list vendors in
    that order too (the cards by the run's own cut-off, so a preview never
    reorders them); each vendor keeps its colour. "Agreed with Jev" is a
    supporting line, not the ranking: "both say
    different" is often the biggest group, so agreement flatters a vendor
    that matches little.
  - **The match cut-off** is a drawer whose tab hangs from the top bar
    ("Match cut-off 0.50"), reachable at any scroll. The first visit's tab
    reads "Try another cut-off" and pulses once. Opening it focuses the
    slider; Esc or closing returns focus to the tab. Moving it previews
    every number on the page live, read-only: nothing is saved, the cards
    say their lists still open at the run's cut-off, and Reset puts it
    back. **Change in What Jev checks** leads to a real new cut-off.
    Detailed analysis's list stays at the run's cut-off and says so in one
    line, with **Preview another on the Overview**, which opens the drawer
    there with the slider focused (`?cutoff=open`, dropped from the address
    once used).
  - **On a phone** the demo banner is one line ("Demo · read-only sample
    data", Sign up), and Download (icon only) shares a row with the run
    picker, so the answer starts sooner.
  - **Overview**, kept to what decides: one head-to-head card per vendor
    (agreement with Jev, correct merges, duplicates found, overall score and
    the four categories, each count opening its pairs; "Best overall" on
    the leader; a card picks the vendor the page describes), "Where should
    you look first?" (close calls, disagreements, the top missed duplicates
    and doubtful merges), "What did Jev check?", "What if the cut-off
    changed?" (led by its steady range) and "Why do they disagree?" (the
    field patterns in a sentence each).
  - **Detailed analysis**, a list and the pair beside it (the prototype's
    layout): All pairs or Disagreements, the vendor, a search, and the
    other filters (score, why checked, checked or not) in one Filters menu;
    each filter in force shows as a chip beside the count, with × to take
    it off, and the menu's badge counts them all.
    The list shows only who says what, the two records (the differing
    words marked) and Jev's score; ↑/↓ move the selection. The selected
    pair shows beside it: Jev's score against the cut-off, who says what,
    the three fields that say most about it (matching identifiers first), and retry for a failed
    pair. Enter, **Full comparison** in the panel's header, or "See all N
    fields on its own page" opens the full comparison, with every column and
    J/K through the list. Picking a row marks it at once and the panel
    follows; the pairs either side are already rendered, so ↑/↓ shows them
    instantly. `?` (or the hint under the list) lists the shortcuts, here
    and on a pair's own page.
  - **On a phone** the selected pair opens in a bottom sheet over the list
    (Previous and Next pair in its header, Esc or the scrim to close)
    instead of below the whole list.
  - The overview keeps only what a bird's-eye view needs. The field-by-field
    pattern table, the score histogram, the why-checked breakdown and the
    vendor overlap were dropped from the page: the cut-off chart, "What did
    Jev check?" and "Why do they disagree?" already say what they did, and
    the PDF report keeps the full comparison.

  The run's threshold is fixed: "Try another" previews precision and recall
  at another value (a "what if"), with no Apply. A different threshold means changing it in
  What Jev checks and running again. Every saved score is reused, so that run is complete at
  once and costs nothing.

- **Pair** — field comparison with differences highlighted, how the pair got
  here ("Suggested by PairSight: the two records share …", or that a vendor
  matched it and PairSight didn't suggest it), Jev's assessment (with retry) and each vendor's decision; J/K/Esc.
- **Not found / errors** — a centred page; signed in, the way back is
  Evaluations. A demo link that's out of date gets the demo's own page,
  with **Back to the demo**; `/sandbox/<id>` itself lands where that
  evaluation is up to, as an owner's does.
- **Export** menu (Results header, beside the run picker) — the run's
  findings as one file, CSV or Excel: every pair, with both records' mapped
  fields, Jev's status, score, model and failure reason, PairSight's decision
  at the run's threshold, low confidence, what found it, and each vendor's
  decision and category. It works in the sandbox too, and is never cached. The
  CSV is UTF-8 with a byte-order mark and formula-safe; the workbook has one
  "Findings" sheet with a bold, frozen, filterable header, sized columns, the
  score as a number and every other cell as text. Every file, read or
  written, goes through one tabular connector
  (`src/server/pairsight/tabular/`): a format is one adapter, and the checks
  are shared. Both files are plain links that stream as they're written, so
  any size downloads with the browser's own progress. Past Excel's
  1,048,575 rows the Excel option is greyed out and the menu says to take
  the CSV. Only the summary report is fetched by the menu, with its
  "getting it ready" toast.
- **Summary report** (Export menu → "Summary report (.pdf)") — a PDF for
  whoever has to justify a vendor choice, built for the analyst handing it to
  their boss:
  1. **The verdict:** which vendor matched most like Jev on these records
     (by F1), plus the safest (fewest wrong merges) and the most complete
     (fewest missed duplicates) when they're different vendors. Then whether
     that lead holds at every threshold, and a scorecard that puts each
     vendor's precision, recall and F1 in business terms.
  2. **Tradeoffs:** what each vendor gets wrong, and which fields those
     pairs usually share or differ on. A chart of each vendor's F1 across
     thresholds, and a head-to-head per pair of vendors: where only one
     matched a pair, whose side Jev took.
  3. **Examples:** each vendor's clearest wrong merges and missed
     duplicates, with the records' fields side by side.
  4. **Method and scope:** the files, the fields sent to Jev, the identity
     definition, coverage (pairs PairSight didn't suggest and no vendor
     matched weren't checked), the
     Jev model and run times, and "Human review: none".

  Every page carries the caveat that these are AI-estimated agreement with
  Jev on evaluated pairs, not verified accuracy. It's drawn on the server
  (`src/server/pairsight/report-pdf/`, `@react-pdf/renderer`) from a pure
  model (`report-summary.ts`), works in the sandbox, and is never cached.

- **Sandbox (`/sandbox`, M4)** — the whole app on three prepared, fictional
  evaluations side by side: customers (people), suppliers (organisations)
  and a product catalogue, each with a pair-format and a group-format
  vendor and one run judged by the real Jev, with no login. (They're being
  re-recorded at about 2,000 fictional records per type, since suggestions
  need at least 200.)
  `/sandbox` is their read-only dashboard; each opens at `/sandbox/<id>/…`. Every screen is the real one,
  read-only: anything that would save, upload or call Jev is shown but inert,
  with a "Sign up to …" tip; What Jev checks is disabled and never saved. What only
  reads still works: filters, tabs, sorting, the threshold preview, pairs
  and J/K. A banner under the top bar says what it is, and when the
  judgments were recorded, beside a Sign up button. Signed out, the sidebar
  offers Sign up / Sign in; signed in, it shows your account but none of
  your evaluations. It's reached from the landing, the auth screens and the
  empty Evaluations page. `pnpm demo:seed` loads it from
  `prisma/demo/sandbox-snapshot.json`; until then it says it isn't set up.

**Design review gate (M4 sign-off, §10.7).** Every screen and state was
captured in both themes at 1440 / 1024 / 390 and reviewed. Fixes:

- Page layouts follow the page's width rather than the window's, so a 1024 px
  window with the sidebar open gets the one-column layout instead of a
  squeezed one.
- The plan's ledger adds up top to bottom.
- A run that finished with failures says so, and Retry leads.
- Mid-run, the shell shows the run.
- Toasts sit above the action bar.
- On phones, the pair's verdict and the records' checks come first.
- On touch screens every tap target is at least 44 px (the `pointer-coarse`
  variant and the `hit-area` utility in `globals.css`); small controls keep
  their look and grow only their tap area.
- Tables show they scroll.
- Text that was cut short wraps instead.

`e2e/public.spec.ts` and `e2e/sandbox.spec.ts` hold axe checks (WCAG 2.2 A/AA)
for every public and sandbox screen in both themes. The signed-in screens and
a keyboard-only pass were checked by hand, and every stop shows a focus
ring.

**How the open questions were settled.**

| #   | Question                         | Decision                                                                 |
| --- | -------------------------------- | ------------------------------------------------------------------------ |
| 1   | Run URLs                         | Runs keep ids and a run switcher                                         |
| 2   | Idle "Ready to run" page; Pause  | Neither: the run starts from Plan; leaving the page pauses it            |
| 3   | Stage gating                     | Derived from the data, enforced on the URL too                           |
| 4   | Detailed tab default             | All pairs, 50 per page (25 and 15 available)                             |
| 5   | Category markers                 | Distinct shapes kept, for colour-blind safety                            |
| 6   | Near the threshold               | The low-confidence flag stays; a "near threshold" score filter was added |
| 7   | Three vendors                    | Supported (up to 3)                                                      |
| 8   | Mapping UI                       | PairSight field → your column; full, first and last name stay separate   |
| 9   | Fixing references inline         | No: problems block, listed with rows, fixed in the file                  |
| 10  | One column on two fields         | Can't happen: choosing a column moves it off the other field             |
| 11  | Editing the mapping after saving | No: the dataset is fixed; replace the file                               |
| 12  | Vendor drafts, rename, stats     | Yes, all three                                                           |
| 13  | Unknown vendor references        | Block                                                                    |
| 14  | Country                          | Chosen by name, stored as the two-letter code; no "Mixed"                |
| 15  | Fields for Jev                   | At least two; "Does not count" is required (it's Jev's `criteria.false`) |
| 16  | Derived rule fields              | Built later, then removed with the rules (Scale Roadmap item 11)         |
| 17  | What Jev checks saving           | Autosave                                                                 |
| 18  | Greeting name                    | A full name asked at onboarding                                          |
| 19  | Sample files                     | Not now; the Sandbox shows a full evaluation instead                     |
| 20  | Toasts                           | Ours, restyled                                                           |

**Components.** `src/components/ui/` holds the foundation listed in
`docs/rules/components.md`; screens compose it in
`src/components/pairsight/` (shell, records, vendors, rules, plan, run,
results and its overview panels, pair). Charts use Recharts, loaded with the
Results page. Retired: IconTile, EmptyState and its ghost previews, Badge,
the native select, the unsaved-changes guard.

## Context

PairSight's agreed scope and build order are in `docs/PairSight-V1-Scope.md`
and `docs/PairSight-Delivery-Plan.md`. There is no product UI yet. The app has
the template's neutral token set in `src/app/globals.css` (switched by
`prefers-color-scheme` only), a small `src/components/ui/` foundation (Button,
Badge, Card, Input, Label, Textarea, toast), Phosphor icons through
`src/components/ui/icons.tsx`, and next-intl.

This plan defines the experience before M1 builds screens: flows, layouts,
brand-based light and dark themes, components, states, and the order of work.
It changes no product behavior. Where the agreed scope leaves a decision open,
the plan flags it rather than inventing functionality. `DESIGN.md` gets the
new tokens when M1 implements them.

## 1. Principles

1. **Always show where you are, what's happening and what's next.** Every screen
   has a title, a one-line explanation and one primary action.
2. **Agreement, not correctness.** Category styling never says right or wrong.
   Brand and status colors are never used for categories.
3. **Report the backend's real status.** Show pending, running, succeeded and
   failed exactly as stored. Never show optimistic "done", and never render a
   failed pair as "no match".
4. **Neutral surfaces, restrained brand.** Brand color marks the primary action,
   the current selection and focus, and nothing else.
5. **Dense but calm.** Tables are the product. Readable rows, aligned numbers
   and no decorative cards.

## 2. User journey (agreed behavior; "Next" means after Friday)

| Stage           | User goal                                                             | Primary action                                  | Backend status shown                          | Notes                                                                                                       |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Start           | Understand the product, try it                                        | **Try demo** / **Start evaluation**             | —                                             | The demo needs no login. Starting requires login.                                                           |
| New evaluation  | Name it                                                               | **Create evaluation**                           | —                                             | Lands on the Records step                                                                                   |
| Records         | Upload the source file, pick the reference column, map roles          | **Continue to vendors**                         | Upload → parsed → validated                   | Missing or duplicate references block continuing                                                            |
| Vendors         | Upload a pair or group file, check its columns, confirm it's complete | **Next: what Jev checks**                       | Validated or errors                           | Unknown references block. Completeness confirmation is required.                                            |
| What Jev checks | Define "same individual", the values Jev sees and the match cut-off   | **Review plan**                                 | Pairs PairSight suggests, and what they share | Waits while PairSight works out the pairs                                                                   |
| Plan            | Check what will be evaluated                                          | **Start run**                                   | Suggestions ready, limit check                | Still suggesting, suggestions failed (Try again), too few records, or over the cap: blocked, with the cause |
| Runs centre     | Watch progress, handle failures (a dialog, not a step)                | **View results** (when done) / **Retry failed** | Exact per-pair counts                         | The run pauses if the app is closed                                                                         |
| Results         | See agreement per vendor, adjust threshold, filter                    | Open a pair                                     | Run status, threshold, model                  | Incomplete pairs are counted separately                                                                     |
| Pair detail     | Understand one decision                                               | **Next pair** (J/K)                             | That pair's assessment status                 | Human review is Next                                                                                        |
| Export          | Take findings away                                                    | **Export** (CSV, Excel, PDF)                    | —                                             | Built: the findings (every pair and vendor) and the summary report.                                         |

## 3. Navigation and hierarchy

- **App shell** (adopted 2026-10-01, "workspace sidebar", chosen from three
  layouts compared side by side; `src/components/pairsight/shell/`). Signed-in
  pages share it; the landing and auth pages keep the plain top header.
  - **Sidebar**, full height: wordmark, **Evaluations**, the current
    evaluation's **pipeline**, then theme and account pinned to the bottom.
    Only the middle scrolls.
  - **Collapse** (desktop): 16.5rem ↔ 4.25rem with a 240 ms transition; labels
    fade, the pipeline keeps its nodes and track, and icons get tooltips.
    Toggled from the top bar or with `[`; remembered in a cookie so the first
    paint is already the right width.
  - **Phones** (below 48rem): the sidebar is a drawer over a scrim, opened by
    the same toggle and closed by Esc, the scrim, or following a link.
  - **Top bar** (48 px as shipped): the sidebar toggle and the breadcrumb,
    Evaluations / {name} / {stage}.
- **Evaluation pipeline** (replaces the step rail): Records → Vendors (Input)
  → What Jev checks → Plan (Configure) → Run (Execute) → Results (Review) on one
  connected track.
  - **Stage states:** done (filled coral + check), active (coral ring — the
    next thing to do, or the run in progress, pulsing), next (hollow), locked
    (dashed + lock, not a link).
  - **Track:** solid coral through finished stages, flowing while a run is
    going, dashed ahead.
  - **Each stage shows its output** in the data font ("24 records",
    "1 vendor · 4 pairs", "run 2 · 1,344 pairs").
  - **Header:** stages done, the evaluation name, a one-line status (setup,
    running, complete, stopped) and one segment per stage.
  - The page you're on is marked separately from pipeline progress.
- **One primary action per stage.** It sits in a sticky action bar at the
  bottom of the content column, with an optional secondary **Back** and a
  status hint ("2 errors to fix before continuing"). The primary button is
  disabled with a reason, never hidden, when blocked.
- **Preserved progress:**
  - Vendor files persist as soon as they're checked. A records file is
    saved by Next (it can still be remapped until then); until it is, the
    browser asks before a reload or a closed tab would lose it.
  - Draft configuration autosaves (debounced, showing "Saved").
  - Reopening an evaluation lands on the first incomplete step, or on Results
    when a run exists.
- **Results and runs:** a run selector ("Run 2 · 30 Sep · threshold 0.60") in
  the Results header. Completed runs stay reproducible.

## 4. Screens (design order: Results → Pair detail → the rest)

### 4.1 Results (design first)

- **Header:**
  - The evaluation name, the run selector, and a run status chip.
  - A meta line: threshold, Jev model, date, and "Prepared results" on the
    demo.
- **Vendor tabs:** only when there's more than one vendor.
- **Summary row:** five equal tiles.
  - The four categories, each with its count, % of evaluated pairs, and a
    one-line meaning ("Potential duplicate the vendor missed").
  - An **Incomplete** tile (pending + failed), styled neutral with a status
    icon.
  - Tiles double as filters, with the selected tile outlined in brand.
  - **Agreement tiles** (Both matched, Neither matched) are visually quieter
    than **disagreement tiles** (PairSight only, Vendor only), to steer
    attention without implying correctness.
- **Coverage strip:** one line, with a "How this works" popover. For example:
  "1,204 pairs checked — 1,168 suggested by PairSight, 36 added only because a
  vendor matched them. Pairs PairSight didn't suggest and no vendor matched
  weren't checked, so missed duplicates among them can't be seen."
- **Threshold control:** a button, "Decision threshold 0.60", opens a popover
  with:
  - a slider and a numeric input
  - an explanation: "Pairs Jev scores at or above this count as a PairSight
    match"
  - the **score distribution chart** with the threshold line
  - a preview of how the counts change
  - no Apply: the run keeps its threshold. **Change in What Jev checks** leads to where
    the next run's threshold is set (see "What shipped").
- **Filter bar** (state in the URL):
  - category (tied to the tiles)
  - why it was checked: all / Suggested by PairSight / Added by a vendor
    (`source=suggested|vendor` in the URL)
  - low confidence
  - status: evaluated / incomplete
  - a search by record reference
  - a result count, and "Clear filters".
- **Table:** 40 px rows, sticky header, tabular numbers, 50 rows per page on
  the server. Columns:
  - Category (badge)
  - Record A and Record B (reference, then name)
  - Vendor decision (matched / not matched)
  - Jev score (a mini bar with a threshold tick, plus the number)
  - PairSight decision
  - Source ("Suggested by PairSight" / "Added because a vendor matched it")
  - Flags (low confidence)
    Incomplete rows show a status chip (Pending / Failed · reason) where the
    score and decision would be, never "no match".
- **Interaction:** clicking a row or pressing Enter opens pair detail. The
  back button keeps filters, page and scroll.

### 4.2 Pair detail

- **Verdict strip:** "Vendor A: matched · PairSight: no match → **Vendor only**",
  plus the qualifier "Agreement, not correctness".
- **Side-by-side comparison table:** one row per mapped field.
  - Columns: Field | Record A | Record B | comparison icon (same, different, one
    missing, both missing).
  - Values are the originals, in monospace for references.
  - Differences get a subtle tinted cell and an icon; tint is never the only
    signal.
  - Unmapped columns sit under a "Show all columns" disclosure.
- **Jev panel:**
  - A score bar (0–1) with the threshold marker, the numeric score, and the
    resulting decision.
  - The model id, when it was evaluated, and "AI judgment: may be wrong".
  - Pending and failed states replace the score, with the reason and a
    **Retry** (live runs only).
- **How this pair got here:** "Suggested by PairSight: the two records share
  the same date of birth and the same email" or "Vendor A matched it.
  PairSight didn’t suggest it, so it was checked only because a vendor
  matched it."
- **Vendor decisions:** one row per vendor when there are several.
- **Navigation:** Previous / Next within the current filtered list (J / K,
  "12 of 87"); Esc returns to results.
- **Human review** (Next) will add a decision panel here. No space is reserved
  now.

### 4.3 Setup steps

Every step has a title, one sentence of context, the content, and the action
bar.

- **Records:**
  - A dropzone (also a file button), then an inline progress line (Uploading →
    Reading → Validating).
  - A preview table of the first 10 rows. Each column header has a role select,
    pre-filled from the header name and labeled "Suggested" until confirmed.
    One column is marked "Record reference".
  - Validation panel:
    - **Errors** block continuing: missing or duplicate references, with row
      numbers (first 20 shown, plus "and 14 more").
    - **Warnings** don't block.
  - Replacing the file is a secondary action that asks for confirmation.
  - Under 200 records: refused, saying PairSight needs at least 200 to learn
    what a duplicate looks like.
- **Vendors:**
  - An "Add vendor" card: name, file, record A and B column selects
    (suggested), and a completeness box explaining the omitted-pair assumption
    with a required checkbox.
  - Results: pairs found, self-pairs skipped, duplicates collapsed, and an
    unknown-reference table.
  - Added vendors are listed with their pair counts. "Add another vendor" only
    when multiple vendors are enabled.
- **What Jev checks** (route and stage key `rules`):
  - **Identity:** the two prefilled text areas, the values Jev sees (at
    least two; default: all mapped) and a country select, then the match
    cut-off.
  - A right-hand card, **The pairs Jev will check**: how many pairs
    PairSight suggests, what they share, and how many of each vendor's pairs
    they already include. While PairSight is still working them out, it
    says so.
- **Plan:**
  - A breakdown list: pairs suggested by PairSight, pairs added by vendors,
    overlap removed, unique total against the cap (100,000 since Scale
    Roadmap item 8), and assessments reused from earlier runs.
  - "What Jev receives": the field list, plus "No vendor names, scores or
    decisions are sent".
  - The estimated calls and cost, labeled as an estimate at a stand-in rate.
  - Still suggesting: Start waits. Suggestions failed: a panel saying so,
    with **Try again**.
  - Over the cap: an error panel showing where the pairs come from
    (suggested, vendor-only), with links to change the records or the
    vendor files.
- **Run** (as first planned; superseded by the Runs centre, "What shipped"):
  - A progress bar with exact counts (succeeded / failed / pending of total),
    elapsed time, and a live region announcing milestones.
  - A callout: "Keep this page open — the run pauses if you leave and resumes
    when you return."
  - Failures: a list of reasons grouped by type, and **Retry failed**.
  - A configuration error (for example, an invalid key) shows a blocking banner
    with the fix, and the run stops.
  - When complete: a success line and **View results**.

### 4.4 Other screens

- **Evaluations list:** a table with name, last run status, pairs, updated, and
  a row action. The empty state has one sentence plus **Create evaluation** and
  **Try the demo**.
- **Landing:** a single screen with the problem statement, three steps, and
  **Try demo** / **Start evaluation**. This is the one place the orange and
  amber brand colors appear decoratively.
- **Demo:** the Results and Pair detail screens, read-only, with a persistent
  banner: "Prepared results recorded from Jev {model} on {date}. Fictional
  data." and a **Start your own evaluation** button.
- **Sign in / Sign up:** a centered card with inline errors.

## 5. State inventory

| State                               | Pattern                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Empty (no evaluations, no vendors)  | One sentence explaining why it matters, plus the one action that fills it                                              |
| Loading (page data)                 | Skeletons shaped like the final layout (table rows, tiles). No spinners over blank pages.                              |
| Working (upload, parsing, counting) | An inline progress line near the control; the primary action disabled with the reason                                  |
| Run progress                        | A progress bar with exact backend counts, polled; `aria-live="polite"` announcements                                   |
| Success                             | An inline confirmation and the next action highlighted; a toast only for background completions                        |
| Validation error                    | A panel above the content: count, what to fix, and affected rows; fields outlined, and icon + text (never color alone) |
| Blocking config error               | A persistent banner with the fix; the run stops                                                                        |
| Pair failed                         | A status chip with the reason and **Retry**; excluded from categories and counted as Incomplete                        |
| No results (filters)                | "No pairs match these filters" plus **Clear filters**                                                                  |
| Partial run                         | Results show a banner, "86% evaluated — 164 pairs incomplete", with a link to the Runs centre                          |
| Demo                                | A persistent banner; editing actions hidden                                                                            |

## 6. Theme tokens (contrast checked)

Adopted 2026-10-07 with the ClickHouse-style revamp: brand coral on pure
neutral greys. It replaces 2026-10-01's "Coral × Slate", whose cool slate
neutrals read as blue-tinted in dark mode. Hues stay (coral, the category,
series and status colours); the neutrals lose their tint, and the brand is
used as exactly three variants: `--action`, `--action-active` (hover and
press) and `--action-disabled`. Every value below was measured against the
surfaces it actually sits on (WCAG 2.1: text ≥ 4.5, control edges and chart
marks ≥ 3), and `scripts/check-contrast.test.mjs` re-checks them on every
`pnpm test`, along with guards that the neutrals stay untinted and the
disabled coral stays visible.

- **Theme switching:** class-based (`.dark` on `<html>`) through
  **`next-themes`**, with a Light / Dark / System menu, preference persisted,
  and no flash on load.
- **Naming:** the repo's semantic names stay the source of truth. shadcn's
  variable names (`--background`, `--primary`, `--accent`, `--ring`, …) are
  aliases of them, so copied shadcn components work unmodified.

| Token                         | Light                                | Dark                  | Use and measured contrast                                                       |
| ----------------------------- | ------------------------------------ | --------------------- | ------------------------------------------------------------------------------- |
| `--bg`                        | `#F6F6F6`                            | `#0A0A0A`             | Page, sidebar and top bar                                                       |
| `--surface`                   | `#FFFFFF`                            | `#161616`             | Cards and tables                                                                |
| `--surface-elevated`          | `#FFFFFF`                            | `#1F1F1F`             | Menus, dialogs, popovers, toasts                                                |
| `--surface-muted`             | `#F0F0F0`                            | `#111111`             | Table headers, sunken areas                                                     |
| `--surface-hover`             | `#F2F2F2`                            | `#1C1C1C`             | Hover for rows, menu items and interactive surfaces                             |
| `--selected`                  | `#EBEBEB`                            | `#242424`             | Selected row, current step, chosen option — always with a coral edge or outline |
| `--ghost`                     | `#EFEFEF`                            | `#1A1A1A`             | Ghost button at rest                                                            |
| `--border`                    | `#E3E3E3`                            | `#2A2A2A`             | Hairlines: card edges and dividers                                              |
| `--border-input`              | `#848484`                            | `#6F6F6F`             | Form controls and essential edges: ≥ 3.14 / 3.09 on every surface               |
| `--text`                      | `#0A0A0A`                            | `#FFFFFF`             | 18.32 / 19.80 on the page                                                       |
| `--text-muted`                | `#5A5A5A`                            | `#A3A3A3`             | Secondary text and placeholders: ≥ 5.79 / 6.15 on every surface                 |
| `--action`                    | `#C93A22`                            | `#FF6A4D`             | The coral: primary buttons, headline numbers, the current step, focus edges     |
| `--action-active`             | `#AE2F19`                            | `#E8573C`             | Hover and press: 6.52 / 5.35 with action-ink                                    |
| `--action-disabled`           | `#F3D6CF`                            | `#3A201B`             | A primary action that can’t be used yet, with muted text                        |
| `--action-ink`                | `#FFFFFF`                            | `#1A0B07`             | Text on action: 5.11 / 6.78                                                     |
| `--diff` / `--diff-ink`       | `#ECECEC` / `#1D5FB8`                | `#262626` / `#8FB6FF` | Changed values in pair detail. Text 16.76 / 15.13; marker 5.26 / 7.42           |
| `--success` / `-subtle`       | `#14773A` / `#E8F6EE`                | `#4ADE9A` / `#12221A` | 5.63 / 10.52 on surface; 5.05 / 9.62 on subtle                                  |
| `--warning` / `-subtle`       | `#8A5A00` / `#FCF3DE`                | `#F7C04F` / `#262011` | 5.93 / 10.86 on surface; 5.37 / 9.72 on subtle                                  |
| `--danger` / `-subtle`        | `#BE1D4B` / `#FCEBF0`                | `#FF6F94` / `#2A161C` | 6.06 / 6.85 on surface; 5.27 / 6.47 on subtle                                   |
| `--info` / `-subtle`          | `#1D5FB8` / `#E8F0FB`                | `#6AAEFF` / `#141D2A` | 6.21 / 7.85 on surface; 5.41 / 7.35 on subtle                                   |
| `--cat-both` / `-subtle`      | `#2F55A8` / `#EAF0FB`                | `#86A8FF` / `#181D2A` | Both matched. 7.03 / 7.81 marks; 6.15 / 7.26 labels                             |
| `--cat-pairsight` / `-subtle` | `#6A3FC0` / `#F1ECFB`                | `#BE9CFF` / `#1F1A2A` | PairSight only. 6.81 / 8.09 marks; 5.88 / 7.57 labels                           |
| `--cat-vendor` / `-subtle`    | `#0B6E68` / `#E3F4F2`                | `#3DD9C5` / `#112321` | Vendor only. 6.10 / 10.28 marks; 5.37 / 9.28 labels                             |
| `--cat-neither` / `-subtle`   | `#5E5E5E` / `#EFEFEF`                | `#A3A3A3` / `#1F1F1F` | Neither matched. 6.48 / 7.17 marks; 5.64 / 6.53 labels                          |
| `--accent` / `--accent-ink`   | `#FDECE8` / `#B3321C`                | `#2A1A24` / `#FF8F79` | Small brand chips, links and coral numbers in text: 6.20 / 8.15 on surface      |
| `--ring`                      | `#C93A22`                            | `#FF8F79`             | Threshold marks                                                                 |
| `--focus`                     | `#1D5FB8`                            | `#6AAEFF`             | Keyboard focus outside fields: ≥ 3 on every surface                             |
| `--cat-incomplete`            | `--text-muted` with a dashed outline | same                  | Pending or failed                                                               |

- **What changed from Coral × Slate (2026-10-01):**
  - **Neutrals:** cool slate → pure greys in both themes (dark: `#0A0A0A`
    page, `#161616` cards, `#1F1F1F` raised), so dark mode is near-black,
    never navy.
  - **Brand:** three variants. Hover and press go a step darker
    (`--action-active`), and a disabled primary is a dimmed coral
    (`--action-disabled`) rather than a grey fill.
  - **Depth:** cards lose their shadows; depth is the surface step plus a
    hairline. The one soft shadow is for floating layers.
  - **Changed values:** `--diff` is a neutral lift; its ink stays blue.
  - **Glass** is deferred: one style.
- **Supporting brand colors:**
  - `#972828`, `#EB7F31` and `#FCAD38` are for the wordmark, the landing page,
    and non-data emphasis.
  - They are **not used for comparison categories or status**.
  - `#FCAD38` (hue 36°) is too close to warning (39°) to mark selected chart
    points; selection uses `--ring` / `--accent-ink`.
  - `#EB7F31` can be a secondary chart series only in charts with no warning
    meaning nearby.
- **Selection:** `--selected` is never the only cue. It's paired with a coral
  left edge, an outline or a label.
- **Destructive actions:** confirmations use an outline danger style, never a
  filled red next to the coral primary.
- **Radius and elevation:** 6 px small, 8 px buttons and inputs, 12 px
  cards and dialogs, pills for chips. Floating surfaces use
  `--surface-elevated` plus one soft shadow; cards use hairlines only.
- **Derived states** are set once in the tokens, not per component:
  - disabled: 50% opacity with no hover
  - active: the hover color plus a 1 px inset
  - All must still meet their contrast target against the surface they sit on.

## 7. Typography, spacing, motion, responsiveness, keyboard

- **Type:**
  - Space Grotesk (400–700) for the interface and JetBrains Mono for data —
    record references, raw values, scores, counts, keyboard hints. Numbers
    that align or change live use the mono. Adopted 2026-10-07, replacing
    Poppins.
  - Named roles, not raw sizes: display 72 / 56 / 40 / 32 (bold, tight),
    title 24 / heading 18 / subheading 16 / eyebrow 12 / body 14 / label 14
    / meta 12 / caption 11, plus the mono data role. The full table is `DESIGN.md` §4.
- **Spacing:** Tailwind's 4 px scale. 24 px card padding, 16 px between cards, a
  1,280 px max content width (1,440 px for Results).
- **Motion:** 120–160 ms color and opacity transitions, a 200 ms popover or sheet
  entrance, and a smooth progress-bar change. `prefers-reduced-motion`
  disables all of it.
- **Responsive:**
  - Desktop-first for data work.
  - At ≤ 1024 px the stepper rail collapses to a top select.
  - At ≤ 768 px the table keeps Category, the records and Score, and moves the
    other columns into an expandable row. Pair detail stacks record A over
    record B, with the comparison icon kept.
- **Keyboard:**
  - Everything is reachable with Tab, with a visible 2 px focus ring.
  - Results table: up/down move the row, Enter opens it, `/` focuses search.
  - Pair detail: J/K for previous/next, Esc to go back.
  - Dialogs trap focus (Radix). The slider supports arrow keys and PageUp/Down.

## 8. Components (shadcn where it fits)

_Original plan; the shipped components are summarised under "What shipped"
above and listed in `docs/rules/components.md`._

- **Setup:**
  - Run `shadcn init` for Tailwind v4 against the alias tokens.
  - Replace shadcn's `lucide-react` imports with `@/components/ui/icons`
    (repo rule), and don't install lucide.
  - Add only components a screen uses.
  - The existing Button, Badge, Card, Input, Label and Textarea stay, updated
    to the new tokens. The existing toast system stays (not sonner).
- **Add:** Select, Checkbox, Switch, Tabs, Table, Dialog, AlertDialog,
  DropdownMenu, Tooltip, Popover, Progress, Skeleton, Separator, Slider,
  Breadcrumb, Alert and Collapsible. (Chart via Recharts was planned; the
  two charts below turned out simple enough to draw with plain elements, so
  no chart library was added.)
- **PairSight-specific components**, composed from the above:
  - `AppShell`, `StepperRail`, `ActionBar`
  - `Dropzone`, `ColumnRoleSelect`, `ValidationPanel`
  - `RuleCard`, `PlanBreakdown`, `RunProgress`
  - `CategoryTile`, `CategoryBadge`, `StatusChip`, `ScoreBar`
  - `CoverageStrip`, `ThresholdPopover`, `PairTable`, `FieldCompareTable`
  - `DemoBanner`, `ThemeMenu`
- **Charts** (only where they answer a question; drawn with plain elements,
  no chart library — `score-histogram.tsx`, `vendor-chart.tsx`):
  1. **Score distribution** with the threshold line, in the threshold popover.
     It answers "how many pairs change if I move the threshold, and how many
     are borderline?"
  2. **Per-vendor category bars**, horizontal and stacked, only with two or
     more vendors. It answers "how does each vendor's agreement profile
     compare?"

  Both use the category tokens, direct labels with counts, and a table
  fallback for screen readers. There's no chart for a single vendor, where the
  tiles already answer the question.

## 9. Visual references (adopt specific qualities, adapted to PairSight)

- **Linear:** app-shell restraint, the left-rail information hierarchy,
  keyboard-first navigation, quick subtle transitions. _Adopt:_ navigation and
  motion. _Not:_ its dark-only aesthetic.
- **Stripe Dashboard:** list tables with filter chips, clear empty states,
  detail pages with a summary header. _Adopt:_ table density, the filter bar,
  empty-state copy.
- **GitHub pull-request split diff:** side-by-side comparison with change
  highlighting and a legend. _Adopt:_ the pair-detail comparison pattern.
- **Flatfile / Airtable CSV import:** a column-mapping preview with a select
  above each column and inline validation. _Adopt:_ the Records and Vendors
  mapping UX.
- **Vercel dashboard (Geist):** neutral surfaces that hold up in both themes,
  crisp typography, compact status badges. _Adopt:_ the neutral scale and the
  badge styling.

## 10. Implementation order (within milestones M1–M4)

1. **Tokens and theme (start of M1):** alias tokens in `globals.css`, the
   `.dark` class, the theme menu, fonts, and shadcn init. Update `DESIGN.md`.
   Add a `scripts/check-contrast.mjs` unit test that asserts every
   token pair's ratio in both themes.
2. **Results and Pair detail design first (M1):** build them against fixture
   data from the demo scenario, in a static page, before the pipeline exists.
   This fixes the visual system (tiles, badges, ScoreBar, tables).
3. **App shell, stepper and action bar (M1):** used by the M1 vertical slice.
4. **Setup steps (M2):** Records, Vendors, Rules, Plan, with every validation
   state.
5. **Run and the results wiring (M3):** progress, failure and retry, the
   threshold popover with the distribution chart, filters, and pair navigation.
6. **Demo, landing, evaluations list, auth screens (M4).**
7. **Design review gate (end of M4, before Friday):**
   - Run the seeded demo dataset and one live fictional run.
   - Screenshot every screen in every state, in **both themes**, at 1,440 /
     1,024 / 390 px.
   - Run an accessibility audit (axe plus a keyboard-only pass).
   - Walk the journey as a new user and check each screen: where am I, what's
     happening, what's next.
   - Fix findings before the design is called complete.

## 11. Decisions once flagged as open

- **Low-confidence band (decided):** ±0.1 around the threshold
  (`LOW_CONFIDENCE_BAND`). It's far wider than Jev's run-to-run noise
  (about ±0.01). It raises a filter, never a category. Evidence:
  `docs/PairSight-V1-Scope.md`, "Verified live".
- **Default threshold (decided):** 0.50 (`DEFAULT_THRESHOLD`). In the live
  check, likely-different pairs scored ≤ 0.11 and likely-same pairs ≥ 0.76,
  so 0.50 sits in a wide gap. It's set in What Jev checks (with Lenient 0.35 and Strict
  0.70 beside it), and each run keeps the threshold it started with.
- **Wordmark (decided):** a text wordmark, "PairSight" in 600 weight with a
  small `--action` coral pair glyph. It's swapped when a real logo arrives.
- **Multiple vendors (built):** up to three, compared side by side.
- **Export and human review:** placements are planned, but the controls stay
  hidden until each is built (Next, per the delivery plan).

## 12. Verification

- The contrast script test passes for every token pair in both themes (text
  ≥ 4.5, UI boundaries and chart marks ≥ 3).
- Playwright e2e covers:
  - the results filters and URL state
  - pair navigation with J/K and Esc
  - the theme menu persisting across reloads, with no flash
  - the validation-error states on Records and Vendors
  - failed pairs shown as Incomplete, never in a category
- An axe check runs on Results, Pair detail and Records in both themes.
- The design review gate in section 10.7 runs before sign-off.

## Files this touches (when implemented)

- `src/app/globals.css`, `DESIGN.md`
- `src/app/[locale]/layout.tsx` (fonts, theme provider)
- `src/components/ui/*` (new shadcn components, existing ones updated to the
  new tokens)
- `src/components/pairsight/*` (the PairSight-specific components)
- `messages/en.json`
- `components.json` (shadcn)
- `docs/PairSight-UX-Plan.md` (this plan), linked from `AGENTS.md`
