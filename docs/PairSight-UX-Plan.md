# PairSight UI/UX plan

Approved 2026-09-30. The design reference for every PairSight screen;
build order follows [PairSight-Delivery-Plan.md](PairSight-Delivery-Plan.md).

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
| Run            | Watch progress, handle failures                             | **View results** (when done) / **Retry failed** | Exact per-pair counts         | The run pauses if the page is closed                                                |
| Results        | See agreement per vendor, adjust threshold, filter          | Open a pair                                     | Run status, threshold, model  | Incomplete pairs are counted separately                                             |
| Pair detail    | Understand one decision                                     | **Next pair** (J/K)                             | That pair's assessment status | Human review is Next                                                                |
| Export         | Take findings away                                          | **Export CSV**                                  | —                             | **Next.** The button is hidden until it exists.                                     |

## 3. Navigation and hierarchy

- **App shell:**
  - A top bar with the PairSight wordmark, **Evaluations**, a theme menu
    (Light / Dark / System) and an account menu.
  - The demo shows a persistent banner instead of the account menu.
- **Evaluation workspace** (`/evaluations/[id]`):
  - **Desktop:** a left rail stepper, Records → Vendors → Rules → Plan → Run →
    Results. Each step is marked not started, complete, needs attention (count),
    or locked (with the reason on hover). Steps after an unresolved error are
    locked.
  - **Mobile:** the stepper becomes a step-select at the top.
  - **Breadcrumb:** Evaluations / {name} / {step}.
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
  - **Apply** recomputes from saved scores, with no Jev calls.
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
- **Run:**
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
| Partial run                                  | Results show a banner, "86% evaluated — 164 pairs incomplete", with a link to the Run page                             |
| Demo                                         | A persistent banner; editing actions hidden                                                                            |

## 6. Theme tokens (contrast checked)

Adopted 2026-09-30. This merges `docs/PairSight-Color-System.md` (the base:
warm neutrals, the exact brand coral on primary actions in both themes, and
dark-mode surface layering) with the pieces it didn't define: input borders,
tinted status backgrounds, and the comparison-category colors. Every value
below was measured against the surfaces it actually sits on (WCAG 2.1: text
≥ 4.5, control edges and chart marks ≥ 3).

- **Theme switching:** class-based (`.dark` on `<html>`) through
  **`next-themes`**, with a Light / Dark / System menu, preference persisted,
  and no flash on load.
- **Naming:** the repo's semantic names stay the source of truth. shadcn's
  variable names (`--background`, `--primary`, `--accent`, `--ring`, …) are
  aliases of them, so copied shadcn components work unmodified.

| Token                         | Light                                | Dark                  | Use and measured contrast                                                        |
| ----------------------------- | ------------------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| `--bg`                        | `#FAF8F7`                            | `#171413`             | Page                                                                             |
| `--surface`                   | `#FFFFFF`                            | `#211D1B`             | Cards, sidebar, tables                                                           |
| `--surface-elevated`          | `#FFFFFF`                            | `#2B2522`             | Menus, dialogs, popovers                                                         |
| `--surface-muted`             | `#F2ECE9`                            | `#302925`             | Table headers, sunken areas                                                      |
| `--border`                    | `#DED4CF`                            | `#50433C`             | Decorative hairlines only (1.5–1.8: not for controls)                            |
| `--border-input`              | `#8C7B71`                            | `#857469`             | Form controls and other essential edges: ≥ 3.46 / ≥ 3.20 on every surface        |
| `--text`                      | `#241C18`                            | `#FAF5F2`             | 15.8 / 16.9                                                                      |
| `--text-muted`                | `#705E55`                            | `#C2AEA3`             | Secondary text and placeholders: ≥ 5.25 / ≥ 6.72 on every surface                |
| `--action`                    | `#E45742`                            | `#E45742`             | Primary action. The exact brand coral in both themes.                            |
| `--action-ink`                | `#241C18`                            | `#241C18`             | Text on action: 4.58 (dark text, never white: white on coral is 3.66)            |
| `--action-hover`              | `#EA6855`                            | `#EA6855`             | 5.27 with action-ink                                                             |
| `--accent`                    | `#FCEAE6`                            | `#3B2520`             | Selected nav, row, step or tile, always paired with a border, indicator or label |
| `--accent-ink`                | `#B83B2A`                            | `#F48977`             | Links and active text: 4.88 / 5.91 on accent, 5.68 / 6.92 on surface             |
| `--ring`                      | `#B83B2A`                            | `#F48977`             | Keyboard focus: ≥ 5.36 / ≥ 6.92                                                  |
| `--success` / `-subtle`       | `#237A52` / `#E8F5EE`                | `#76D6A2` / `#1B2D23` | 5.28 on surface; 4.71 / 8.24 on subtle                                           |
| `--warning` / `-subtle`       | `#946000` / `#FBF1DE`                | `#F3C56B` / `#33291A` | 5.34 on surface; 4.77 / 8.83 on subtle                                           |
| `--danger` / `-subtle`        | `#B8254F` / `#FCEDF1`                | `#FF8FAE` / `#3A1F27` | Hue 343°, 25° from the brand's 8°. 6.15 / 7.79 on surface; 5.42 / 6.97 on subtle |
| `--info` / `-subtle`          | `#2864B4` / `#E9F0FA`                | `#91BCFF` / `#1E2635` | 5.88 / 8.63 on surface; 5.13 / 7.83 on subtle                                    |
| `--cat-both` / `-subtle`      | `#3F5E9E` / `#EDF1F9`                | `#8AA4DB` / `#222838` | Both matched (quiet). 6.35 / 6.70 marks; 5.61 / 5.89 labels                      |
| `--cat-pairsight` / `-subtle` | `#6841B0` / `#F1ECFA`                | `#B39AF0` / `#2A2338` | PairSight only. 7.07 / 7.00; 6.10 / 6.30                                         |
| `--cat-vendor` / `-subtle`    | `#0C6B75` / `#E5F3F4`                | `#4FC1C9` / `#172E30` | Vendor only. 6.22 / 7.80; 5.47 / 6.67                                            |
| `--cat-neither` / `-subtle`   | `#6B625D` / `#F2ECE9`                | `#A89A92` / `#302925` | Neither matched (quiet, warm gray). 5.95 / 6.13; 5.08 / 5.24                     |
| `--cat-incomplete`            | `--text-muted` with a dashed outline | same                  | Pending or failed                                                                |

- **What changed from the source documents:**
  - **Error hue:** error moves from `#B42338` / `#FF91A1` (hue 351°, only 16°
    from the brand) to `#B8254F` / `#FF8FAE` (343°), so error never reads as
    brand. Contrast rises too.
  - **Input border:** added, because neither `--border` value can serve as a
    control edge.
  - **Faint text:** dropped. No warm faint gray reaches 4.5 on the muted
    surface, so muted text covers secondary text and placeholders.
  - **Status and category colors:** tinted backgrounds and the four
    comparison-category colors are added; the brand palette alone can't carry
    them.
- **Supporting brand colors:**
  - `#972828`, `#EB7F31` and `#FCAD38` are for the wordmark, the landing page,
    and non-data emphasis.
  - They are **not used for comparison categories or status**.
  - `#FCAD38` (hue 36°) is too close to warning (39°) to mark selected chart
    points; selection uses `--ring` / `--accent-ink`.
  - `#EB7F31` can be a secondary chart series only in charts with no warning
    meaning nearby.
- **Selection:** the accent background is never the only cue. It's paired with
  a left indicator bar, an outline or a label.
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
  - Inter through `next/font` (no dependency), with `tabular-nums` for every
    number. JetBrains Mono through `next/font` for record references and raw
    values in inspection.
  - Scale: 12 (meta) / 14 (body, table) / 16 (lead) / 20 (section) /
    24 (page title). Weights 400/500/600.
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

- **Setup:**
  - Run `shadcn init` for Tailwind v4 against the alias tokens.
  - Replace shadcn's `lucide-react` imports with `@/components/ui/icons`
    (repo rule), and don't install lucide.
  - Add only components a screen uses.
  - The existing Button, Badge, Card, Input, Label and Textarea stay, updated
    to the new tokens. The existing toast system stays (not sonner).
- **Add:** Select, Checkbox, Switch, Tabs, Table, Dialog, AlertDialog,
  DropdownMenu, Tooltip, Popover, Progress, Skeleton, Separator, Slider,
  Breadcrumb, Alert, Collapsible, and Chart (Recharts).
- **PairSight-specific components**, composed from the above:
  - `AppShell`, `StepperRail`, `ActionBar`
  - `Dropzone`, `ColumnRoleSelect`, `ValidationPanel`
  - `RuleCard`, `PlanBreakdown`, `RunProgress`
  - `CategoryTile`, `CategoryBadge`, `StatusChip`, `ScoreBar`
  - `CoverageStrip`, `ThresholdPopover`, `PairTable`, `FieldCompareTable`
  - `DemoBanner`, `ThemeMenu`
- **Charts** (only where they answer a question; loaded lazily on Results):
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

## 11. Unresolved decisions (flagged, not invented)

- **Low-confidence band width:** set after the M1 Jev test. The filter exists;
  its width is configured later.
- **Default threshold:** set after the M1 test. The UI shows whatever the run
  stores.
- **Wordmark (decided):** a text wordmark, "PairSight" in 600 weight with a
  small `--action` coral pair glyph. It's swapped when a real logo arrives.
- **Export, human review, metrics, multiple vendors:** placements are planned,
  but the controls stay hidden until each is built (Next, per the delivery
  plan).

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
