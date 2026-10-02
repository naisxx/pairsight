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
(blocking, mapping, validation, runs, gating); the look, layout, copy and
motion follow the design. Export and human review are **not built**:
anything of theirs in the design is hidden until they are. The demo became
the Sandbox (below).

**Shell.** A 248 px sidebar (60 px collapsed, a 280 px drawer on phones,
toggled with `[` and remembered in a cookie) holds the Evaluations link, the
current evaluation's name and a numbered pipeline (done, active, next,
locked — a locked step says why). A 48 px top bar shows the breadcrumb and
the evaluation's status chip. Pages are a centred column (1280 px; 1440 px
for Results and Pair) that scrolls inside `<main>`, with an action bar docked
to its bottom: Back on the left, the primary action on the right and the
reason it's blocked beside it. A locked step can't be opened by URL either:
it redirects to where the evaluation is up to.

**Screens.**

- **Landing (`/`, signed out only)** — hero with a static product preview,
  How it works, Honest about what it measures, a call to action and footer.
  Signed in, `/`, `/sign-in` and `/sign-up` go to `/evaluations`.
- **Sign in / Sign up / Welcome** — one column, the form in a card; fields
  are checked once submitted (then as you type), never on blur; a show/hide
  password toggle. Welcome asks for a full name (required, ≤ 100) before the
  app opens.
- **Evaluations** — a greeting, a summary strip, the latest finished run's
  precision/recall/F1 per vendor, Continue setup with stage bars, and a
  searchable table with Open / Rename / Delete. Names are unique per
  account, ignoring case.
- **Records** — drop zone; then each PairSight field mapped to one of your
  columns (with suggestions and sample values), a Validation panel checking
  references as you choose, and a 10-row preview. Continue saves and goes to
  Vendors. Once saved the dataset is read-only; Replace file asks first.
- **Vendors** — a vendor list beside an editor. Each vendor is a draft until
  confirmed complete; it can be renamed or removed. Drop the file and
  PairSight works out pair or group format and the columns from your records'
  references ("Read as …", with Change to override). Group exports expand to
  every pair in each group. Unknown references block, with row numbers.
- **Rules** — identity definitions (both required), country by name, at
  least two fields for Jev; preset rules with an example key and
  Buckets/Pairs/Largest; composite rules to add, edit and delete; a live
  summary. The **match threshold** is set here too: Lenient 0.35 / Balanced
  0.50 / Strict 0.70, or a custom value from 0.01 to 0.99. It's decided before
  any results are seen, and the next run keeps it. Changes save themselves;
  invalid ones are held back with the reason.
- **Plan** — the "From records to pairs" ledger (with the cost estimate), the
  match threshold the run will keep (with Change, back to Rules), What Jev
  sees, the vendor-pair promise, an over-limit alert with a Turn off
  per rule, and a notice for unfinished vendors. Start evaluation runs it.
- **Runs centre** (replaces the Run step; the pipeline is now Records →
  Vendors → Rules → Plan → Results). A dialog opened from **Runs** in the top
  bar on every app page, with a spinner and a count while something runs.
  - **Contents:** every run across your evaluations, in two tabs. Active is
    the default while something runs, otherwise Completed. Completed holds
    finished runs, runs finished with failures (Retry failed on the card),
    and stopped runs (a red card with the reason, the fix and Resume).
  - **Cards:** the front shows run and evaluation, status, live progress or
    pairs and threshold, and the one action that matters. Details expand to
    everything the run was run with: threshold and preset, judgments reused
    and new, why pairs failed, Jev model, vendors and files, rules, fields,
    country, identity text, times and the run ID.
  - **Starting a run:** Start opens the centre on Active. On completion the
    run moves to Completed and you're taken to its results. Closed early,
    the run keeps going and a toast offers its results when it's done.
  - **Driving:** the run loop lives in the shell, so a run keeps going on any
    page; closing the app pauses it.
  - **Old Run page links** redirect to the run's results with the centre
    open on it (`?runs=<id>`).
- **Results** — Overview (metrics, coverage, categories, decision matrix,
  threshold sensitivity, vendor comparison and overlap, field patterns, top
  disagreements, score distribution, sources, workload) and Detailed
  analysis (live filters, sortable table, retry per row). The run's threshold
  is fixed: its popover previews precision and recall at another value (a
  "what if"), with no Apply. A different threshold means changing it in Rules
  and running again. Every saved score is reused, so that run is complete at
  once and costs nothing.
- **Pair** — field comparison with differences highlighted, how the pair got
  here, Jev's assessment (with retry) and each vendor's decision; J/K/Esc.
- **Not found / errors** — a centred page; signed in, the way back is
  Evaluations.
- **Sandbox (`/sandbox`, M4)** — the whole app on one prepared, fictional
  evaluation (24 records, a pair-format and a group-format vendor, one run
  judged by the real Jev), with no login. Every screen is the real one,
  read-only: anything that would save, upload or call Jev is shown but inert,
  with a "Sign up to …" tip; rules are disabled and never saved. What only
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
- The plan's ledger adds up top to bottom; rules count only when they can run.
- A run that finished with failures says so, and Retry leads.
- Mid-run, the shell shows the run.
- Toasts sit above the action bar.
- On phones, the pair's verdict and the records' checks come first.
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
| 16  | Derived rule fields              | Not now                                                                  |
| 17  | Rules saving                     | Autosave                                                                 |
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

| Stage          | User goal                                                   | Primary action                                  | Backend status shown          | Notes                                                                               |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| Start          | Understand the product, try it                              | **Try demo** / **Start evaluation**             | —                             | The demo needs no login. Starting requires login.                                   |
| New evaluation | Name it                                                     | **Create evaluation**                           | —                             | Lands on the Records step                                                           |
| Records        | Upload the source CSV, pick the reference column, map roles | **Continue to vendors**                         | Upload → parsed → validated   | Missing or duplicate references block continuing                                    |
| Vendors        | Upload a pair CSV, pick A/B columns, confirm it's complete  | **Continue to rules**                           | Validated or errors           | Unknown references block. Completeness confirmation is required. Group CSV is Next. |
| Rules          | Define "same individual" and the blocking rules             | **Review plan**                                 | Live pair counts per rule     | Warning above 50 records per bucket                                                 |
| Plan           | Check what will be evaluated                                | **Start evaluation**                            | Limit check                   | Over the cap: blocked, with the cause                                               |
| Runs centre    | Watch progress, handle failures (a dialog, not a step)      | **View results** (when done) / **Retry failed** | Exact per-pair counts         | The run pauses if the app is closed                                                 |
| Results        | See agreement per vendor, adjust threshold, filter          | Open a pair                                     | Run status, threshold, model  | Incomplete pairs are counted separately                                             |
| Pair detail    | Understand one decision                                     | **Next pair** (J/K)                             | That pair's assessment status | Human review is Next                                                                |
| Export         | Take findings away                                          | **Export CSV**                                  | —                             | **Next.** The button is hidden until it exists.                                     |

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
  → Rules → Plan (Configure) → Run (Execute) → Results (Review) on one
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
  - Uploads persist as soon as they're validated.
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
  "1,204 pairs evaluated — 1,168 from your rules, 36 added only because a vendor
  matched them. Pairs outside your rules that no vendor matched weren't
  evaluated, so missed duplicates among them can't be seen."
- **Threshold control:** a button, "Decision threshold 0.60", opens a popover
  with:
  - a slider and a numeric input
  - an explanation: "Pairs Jev scores at or above this count as a PairSight
    match"
  - the **score distribution chart** with the threshold line
  - a preview of how the counts change
  - no Apply: the run keeps its threshold. **Change in Rules** leads to where
    the next run's threshold is set (see "What shipped").
- **Filter bar** (state in the URL):
  - category (tied to the tiles)
  - source: all / from rules / added by vendor
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
  - Source ("Rules: Email" / "Added by vendor")
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
- **How this pair got here:** "Found by rules: Phone; Last name + postcode" or
  "Added because Vendor A matched it (outside your rules)".
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
  - **Advanced** (collapsed): the fields sent to Jev (default: all mapped).
- **Vendors:**
  - An "Add vendor" card: name, file, record A and B column selects
    (suggested), and a completeness box explaining the omitted-pair assumption
    with a required checkbox.
  - Results: pairs found, self-pairs skipped, duplicates collapsed, and an
    unknown-reference table.
  - Added vendors are listed with their pair counts. "Add another vendor" only
    when multiple vendors are enabled.
- **Rules:** two sections.
  - **Identity:** the two prefilled text areas and a country select.
  - **Blocking:** preset rule cards (Email, Phone, Name, Name + postcode) with
    toggle switches. Each card shows its normalization in one line ("lowercase,
    trimmed; dots and +tags kept") and live stats: buckets, pairs, largest
    bucket, and a warning above 50 records per bucket.
  - **Advanced** (collapsed): a custom composite rule of 1–3 fields.
  - A right-hand summary: running unique pairs, vendor pairs outside the rules,
    and the cap.
- **Plan:**
  - A breakdown list: pairs from rules, pairs added by vendors, overlap removed,
    unique total against the 5,000 cap, and assessments reused from earlier
    runs.
  - "What Jev receives": the field list, plus "No vendor names, scores or
    decisions are sent".
  - The estimated calls and cost, labeled as an estimate at a stand-in rate.
  - Over the cap: an error panel naming the rule or vendor responsible, with
    fixes (turn off a rule, reduce the input).
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

| State                                        | Pattern                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Empty (no evaluations, no vendors, no rules) | One sentence explaining why it matters, plus the one action that fills it                                              |
| Loading (page data)                          | Skeletons shaped like the final layout (table rows, tiles). No spinners over blank pages.                              |
| Working (upload, parsing, counting)          | An inline progress line near the control; the primary action disabled with the reason                                  |
| Run progress                                 | A progress bar with exact backend counts, polled; `aria-live="polite"` announcements                                   |
| Success                                      | An inline confirmation and the next action highlighted; a toast only for background completions                        |
| Validation error                             | A panel above the content: count, what to fix, and affected rows; fields outlined, and icon + text (never color alone) |
| Blocking config error                        | A persistent banner with the fix; the run stops                                                                        |
| Pair failed                                  | A status chip with the reason and **Retry**; excluded from categories and counted as Incomplete                        |
| No results (filters)                         | "No pairs match these filters" plus **Clear filters**                                                                  |
| Partial run                                  | Results show a banner, "86% evaluated — 164 pairs incomplete", with a link to the Runs centre                          |
| Demo                                         | A persistent banner; editing actions hidden                                                                            |

## 6. Theme tokens (contrast checked)

Adopted 2026-10-01: **Coral × Slate**, chosen from three candidates
compared side by side. It replaces the 2026-09-30 palette, whose warm brown
neutrals made dark mode read like a device's night mode: sepia surfaces,
brown selection tints, and cards that barely separated from the page. Brand
coral stays; the neutrals move to cool slate. Every value below was measured
against the surfaces it actually sits on (WCAG 2.1: text ≥ 4.5, control edges
and chart marks ≥ 3), and `scripts/check-contrast.test.mjs` re-checks them on
every `pnpm test`, along with a guard that the neutrals stay cool.

- **Theme switching:** class-based (`.dark` on `<html>`) through
  **`next-themes`**, with a Light / Dark / System menu, preference persisted,
  and no flash on load.
- **Naming:** the repo's semantic names stay the source of truth. shadcn's
  variable names (`--background`, `--primary`, `--accent`, `--ring`, …) are
  aliases of them, so copied shadcn components work unmodified.

| Token                         | Light                                | Dark                  | Use and measured contrast                                                                                  |
| ----------------------------- | ------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--bg`                        | `#F6F7F9`                            | `#0B0F14`             | Page                                                                                                       |
| `--surface`                   | `#FFFFFF`                            | `#121821`             | Cards, sidebar, tables                                                                                     |
| `--surface-elevated`          | `#FFFFFF`                            | `#18202B`             | Menus, dialogs, popovers, toasts                                                                           |
| `--surface-muted`             | `#EEF1F4`                            | `#0E131A`             | Table headers, sunken areas, disabled buttons                                                              |
| `--surface-hover`             | `#F1F4F7`                            | `#19212C`             | Hover for rows, menu items and interactive surfaces                                                        |
| `--selected`                  | `#E6EDF6`                            | `#1E2B3F`             | Selected row, current step, enabled rule, drop target — always with a coral edge or outline                |
| `--ghost`                     | `#EFF2F6`                            | `#151C26`             | Ghost button at rest, so it reads as a button before hover                                                 |
| `--diff` / `--diff-ink`       | `#E4EDFB` / `#1D5FB8`                | `#1D2C47` / `#8FB6FF` | Changed values in pair detail (a difference, not a warning). Text 15.30 / 11.87; marker 5.27 / 6.85        |
| `--border`                    | `#DDE2E9`                            | `#263140`             | Decorative hairlines only — too faint for a control edge                                                   |
| `--border-input`              | `#7D8898`                            | `#6B788B`             | Form controls and essential edges: ≥ 3.05 / ≥ 3.18 on every surface                                        |
| `--text`                      | `#0F1720`                            | `#E8EDF3`             | 16.83 / 16.33 on the page                                                                                  |
| `--text-muted`                | `#4E5A6A`                            | `#A3AEBC`             | Secondary text and placeholders: ≥ 5.95 / ≥ 6.34 on every surface                                          |
| `--action`                    | `#C93A22`                            | `#FF6A4D`             | Primary action. Deeper coral in light (so white text passes), brighter in dark                             |
| `--action-ink`                | `#FFFFFF`                            | `#1A0B07`             | Text on action: 5.11 / 6.78                                                                                |
| `--action-hover`              | `#AE2F19`                            | `#FF8469`             | 6.52 / 8.00 with action-ink                                                                                |
| `--accent`                    | `#FDECE8`                            | `#2A1A24`             | Small brand chips only (step numbers, “Suggested”). Never a large area: coral over dark slate turns maroon |
| `--accent-ink`                | `#B3321C`                            | `#FF8F79`             | Links and active text: 6.20 / 8.03 on surface                                                              |
| `--ring`                      | `#C93A22`                            | `#FF8F79`             | Threshold marks: ≥ 4.33 / ≥ 6.42                                                                           |
| `--focus`                     | `#1D5FB8`                            | `#6AAEFF`             | Keyboard focus, blue so it never reads as an error: ≥ 3 on every surface                                   |
| `--success` / `-subtle`       | `#14773A` / `#E8F6EE`                | `#4ADE9A` / `#10271D` | 5.63 / 10.36 on surface; 5.05 / 9.18 on subtle                                                             |
| `--warning` / `-subtle`       | `#8A5A00` / `#FCF3DE`                | `#F7C04F` / `#2A2210` | 5.93 / 10.70 on surface; 5.37 / 9.45 on subtle                                                             |
| `--danger` / `-subtle`        | `#BE1D4B` / `#FCEBF0`                | `#FF6F94` / `#2E1520` | 6.06 / 6.75 on surface; 5.27 / 6.39 on subtle                                                              |
| `--info` / `-subtle`          | `#1D5FB8` / `#E8F0FB`                | `#6AAEFF` / `#12213A` | 6.21 / 7.73 on surface; 5.41 / 6.99 on subtle                                                              |
| `--cat-both` / `-subtle`      | `#2F55A8` / `#EAF0FB`                | `#86A8FF` / `#18223A` | Both matched (quiet). 7.03 / 7.69 marks; 6.15 / 6.82 labels                                                |
| `--cat-pairsight` / `-subtle` | `#6A3FC0` / `#F1ECFB`                | `#BE9CFF` / `#221A38` | PairSight only. 6.81 / 7.97 marks; 5.88 / 7.38 labels                                                      |
| `--cat-vendor` / `-subtle`    | `#0B6E68` / `#E3F4F2`                | `#3DD9C5` / `#0F2A28` | Vendor only. 6.10 / 10.12 marks; 5.37 / 8.63 labels                                                        |
| `--cat-neither` / `-subtle`   | `#56606E` / `#EEF1F4`                | `#9AA6B6` / `#1B2230` | Neither matched (quiet). 6.38 / 7.22 marks; 5.62 / 6.45 labels                                             |
| `--cat-incomplete`            | `--text-muted` with a dashed outline | same                  | Pending or failed                                                                                          |

- **What changed from the 2026-09-30 palette:**
  - **Neutrals:** warm brown → cool slate in both themes, with clearer steps
    between page, card, raised and sunken surfaces.
  - **Coral:** light mode uses a deeper coral (`#C93A22`) with white text;
    dark mode a brighter one (`#FF6A4D`) with near-black text.
  - **Selection:** new `--selected` (a cool slate lift) plus a coral edge,
    instead of a coral tint, which turned maroon on dark.
  - **Changed values:** new `--diff` / `--diff-ink` (cool blue) instead of the
    warning tint, which turned muddy brown on dark and wrongly read as a
    problem.
  - **Ghost buttons:** new `--ghost` resting background.
  - **Disabled buttons:** a neutral muted fill instead of 50% opacity, which
    turned the coral button brown.
  - **Menus and selects:** hover uses `--surface-hover`, not the brand tint.
  - **Faint text:** still dropped; muted text covers secondary text and
    placeholders.
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
- **Radius and elevation:** keep the existing 6/10/16 px radii. Elevated
  surfaces use `--surface-elevated` plus one soft shadow; cards use borders.
- **Derived states** are set once in the tokens, not per component:
  - disabled: 50% opacity with no hover
  - active: the hover color plus a 1 px inset
  - All must still meet their contrast target against the surface they sit on.

## 7. Typography, spacing, motion, responsiveness, keyboard

- **Type:**
  - Poppins (400/500/600) for the interface and JetBrains Mono for data —
    record references, raw values, scores, counts, rule keys, keyboard hints.
    Poppins has proportional digits and no tabular figures, so numbers that
    align or change live use the mono. Adopted 2026-10-01, replacing Inter.
  - Named roles, not raw sizes: display 36 / title 24 / heading 16 /
    subheading 14 / body 14 / label 14 / meta 12 / overline 11, plus the two
    mono data roles. The full table is `DESIGN.md` §4.
- **Spacing:** Tailwind's 4 px scale. 16 px card padding, 24 px section gaps, a
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
  so 0.50 sits in a wide gap. It's set in Rules (with Lenient 0.35 and Strict
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
