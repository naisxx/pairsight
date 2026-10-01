# PairSight design system

PairSight's "Coral × Slate" palette: brand coral (with `#972828`, `#EB7F31`
and `#FCAD38` for decoration) on cool slate neutral surfaces, in light and
dark. The full UI/UX
reference — journey, screens, states, and every token value with its measured
contrast — is [docs/PairSight-UX-Plan.md](docs/PairSight-UX-Plan.md) (§6 for
tokens). This file keeps the conventions every component follows.

**Contrast is tested, not assumed.** `scripts/check-contrast.test.mjs` (part
of `pnpm test`) reads the values out of `globals.css` and asserts WCAG AA for
every text/surface pairing and 3:1 for control edges and chart marks, in both
themes. Change a token and that test tells you whether it still passes.

## 1. Tokens live in `src/app/globals.css`'s `@theme` block

Not a `tailwind.config.js` — Tailwind v4 is CSS-first, tokens are CSS
custom properties. Two categories:

- **Sizing/spacing** — use Tailwind's built-in scale (`p-4`, `gap-2`,
  `text-lg`, ...) rather than inventing a parallel one. It's already a
  token system; redefining it is the more common design-system mistake,
  not a missing piece.
- **Everything brand-specific** — color, radius, shadow, font family — goes
  in `@theme` as semantic custom properties, not literal Tailwind class
  overrides scattered through components.

## 2. Name tokens by role, not by value

`--action`, not `--coral-500`. A rename should never cascade through every
component that uses it. Values for both themes live in `globals.css`; the
measured contrast for each is in the UX plan §6.

| Token                                                                             | Role                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--bg`                                                                            | Page background                                                                                                    |
| `--surface` / `--surface-elevated` / `--surface-muted`                            | Cards and tables / menus and dialogs / table headers and sunken areas                                              |
| `--surface-hover`                                                                 | Hover state for rows, menu items and interactive surfaces                                                          |
| `--selected`                                                                      | Selected row, current step, enabled rule — always with a coral edge or outline, never a brand tint                 |
| `--ghost`                                                                         | Ghost button at rest                                                                                               |
| `--diff` / `--diff-ink`                                                           | A changed value in pair detail and its ≠ marker (a difference, not a warning)                                      |
| `--border`                                                                        | Decorative hairlines only — too faint for a control edge                                                           |
| `--border-input`                                                                  | Form controls and any essential boundary (≥ 3:1 on every surface)                                                  |
| `--text` / `--text-muted`                                                         | Primary / secondary text (muted also covers placeholders; there is no fainter text token)                          |
| `--action` / `--action-hover` / `--action-ink`                                    | The primary action: deeper coral with white ink in light, brighter coral with near-black ink in dark               |
| `--accent` / `--accent-ink`                                                       | Small brand chips only (never a large area: coral over dark slate turns maroon) / links and active text            |
| `--ring`                                                                          | Keyboard focus                                                                                                     |
| `--success` / `--warning` / `--danger` / `--info` (+ `-subtle`)                   | Status only, never decoration; always with an icon or label. Danger's hue is kept 25° from the brand               |
| `--cat-both` / `--cat-pairsight` / `--cat-vendor` / `--cat-neither` (+ `-subtle`) | The four comparison categories. They mean **agreement, not correctness**, so they never use brand or status colors |
| `--brand-deep` / `--brand-orange` / `--brand-amber`                               | Decorative brand only (wordmark, landing). Never status or data                                                    |
| `--color-brand`                                                                   | The logo's coral, fixed in both themes. The mark only                                                              |
| `--series-a` / `--series-b`                                                       | Chart series that aren't categories (metrics, vendors side by side)                                                |
| `--shadow` (`shadow-elevated`)                                                    | Anything floating above the page: menus, popovers, tooltips, dialogs, toasts                                       |

shadcn/ui's variable names (`--background`, `--primary`, `--muted`, …) are
aliases of these in `globals.css`, so copied shadcn components work unmodified.
Change values in the PairSight tokens, never in the aliases.

Themes are class-based: `next-themes` sets `.dark` on `<html>` from the
Light / Dark / System menu (`src/components/pairsight/theme-menu.tsx`), with no
flash on load. Use `dark:` variants only for things tokens can't express.

## 3. Component conventions

- Build variant components (buttons, badges, alerts — anything with more
  than two visual states) with `class-variance-authority` (`cva`), not a
  chain of ternaries in `className`. Compose the result through `cn()`
  (`src/lib/cn.ts`, `clsx` + `tailwind-merge`) so a caller can still
  override/extend classes without Tailwind's cascade fighting itself.
- No hardcoded hex colors, pixel radii, or arbitrary spacing values in
  component code — if a value isn't expressible with an existing token or
  Tailwind's default scale, that's a signal to add a token, not to reach
  for `style={{ ... }}` or a one-off `bg-[#...]`.
- Every interactive element gets a visible `:focus-visible` state — the
  default browser outline is acceptable; removing it without replacing it
  is not.
- Respect `prefers-reduced-motion` for any animation beyond a simple
  opacity/color transition.

## 4. Typography

Two typefaces, both loaded through `next/font` (no dependency) in
`src/app/[locale]/layout.tsx`:

- **Poppins** (400 / 500 / 600) is the interface: headings, labels, prose,
  buttons, badges.
- **JetBrains Mono** is the data voice: anything the user reads _exactly_
  rather than skims.

Components use the named roles in `globals.css`, never raw `text-sm` /
`text-xs`, so a heading or a label looks the same on every screen. Colour
stays a separate class (`text-text`, `text-text-muted`, …).

| Role              | Spec                                   | Use                                                                         |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `type-display`    | Poppins 36 / 44, 600 (48 on `sm`)      | Landing hero only                                                           |
| `type-title`      | Poppins 22 / 30, 600 (24 / 32 on `md`) | Page titles (`StepHeader`, the evaluations list)                            |
| `type-heading`    | Poppins 16 / 24, 600                   | Section and card titles, dialog titles, the pair verdict                    |
| `type-subheading` | Poppins 14 / 20, 600                   | Headings inside a card: rule names, panel titles, notice titles, tile names |
| `type-body`       | Poppins 14 / 22, 400                   | Prose, notices, table cells, inputs                                         |
| `type-label`      | Poppins 14 / 20, 500                   | Form labels, nav, tabs, record names, text links                            |
| `type-ui`         | Poppins 13 / 20, 400                   | Controls, navigation, menus, table text — a step under body copy            |
| `type-meta`       | Poppins 12 / 18, 400                   | Hints, captions, relative times, chips                                      |
| `type-caption`    | Poppins 11 / 16, 400                   | Sidebar captions, pipeline summaries, small chart labels                    |
| `type-overline`   | Poppins 11 / 16, 600, uppercase        | Table column headers                                                        |
| `type-metric`     | Poppins 28 / 36, 600                   | The count on a category tile                                                |
| `type-data`       | JetBrains Mono 13 / 20                 | Raw record values, numbers in a column, the threshold input                 |
| `type-data-sm`    | JetBrains Mono 12 / 18                 | Record references, file names, CSV headers, rule keys and stats             |
| `type-kbd`        | JetBrains Mono 11, key cap             | Keyboard shortcuts                                                          |

**Where the mono goes, and why:**

- **Data values:** record references, raw values in pair detail (so `Smith`
  vs `Smyth` is compared character by character), CSV headers and sample rows
  in the column mapping, file names.
- **Numbers that align or move:** Poppins' digits are proportional (a `1` is
  half the width of a `0`) and it has no tabular figures, so `tabular-nums`
  does nothing. Scores, plan counts, rule stats and live run counters use the
  mono roles; otherwise columns misalign and counters jitter as they tick.
  Numbers inside a sentence ("Run 2 · 8 pairs") stay in Poppins.
- **Rule keys:** each blocking rule shows the field ids it matches on
  (`name` + `postcode`) under its friendly title — the title is the label, the
  key is the definition.
- **Keyboard hints:** `J` `K` `Esc` as key caps.

Never use the mono for headings, buttons, category names or prose.

## 5. Layout and spacing

Signed-in pages use the app shell (`src/components/pairsight/shell/`); the UX
plan §3 describes its behaviour. Spacing follows one system so every screen
lines up:

| Thing                   | Value                                      |
| ----------------------- | ------------------------------------------ |
| Grid                    | Tailwind's 4 px scale                      |
| Top bar, sidebar header | 56 px (`h-14`)                             |
| Page padding            | 32 px (`px-8`), 16 px on phones; 28 px top |
| Between sections        | 24 px (`gap-6`)                            |
| Inside a card           | 20 px (`p-5`)                              |
| Controls, nav items     | 36 px tall (`h-9`)                         |
| Table rows              | 48 px                                      |
| Sidebar                 | 16.5rem expanded, 4.25rem collapsed        |

- **Content fills the width the shell leaves it,** so collapsing the sidebar
  widens tables instead of leaving a gap; only very wide screens cap it
  (110rem) and centre it.
- **Everything in the sidebar sits on one centre line** in both widths (icons,
  pipeline nodes, the avatar), so collapsing never shifts them.
- **The action bar** docks to the bottom of the page column, edge to edge: it
  rests at the bottom of a short page and stays in view on a long one. A page
  column is a flex column, so buttons and links placed directly in it need
  `self-start` to keep their natural width.
- **Grids that change column count** always declare a shrinkable column at
  every size (`grid-cols-[minmax(0,1fr)]`), or a wide table widens the page
  instead of scrolling.
- **Icons in tiles.** Section and card headings carry a 32 px `IconTile`
  (muted surface, hairline border, line icon); icons never get colour except
  for status. Active and selected states use the `solid` variant.
- **Empty states** use one component, `EmptyState`: a 56 px tile with a
  duotone icon (coral second layer), a heading, one line of explanation and
  the next action, left-aligned. Screens shaped like a list or table put a
  faint dashed ghost of that content behind it (`preview="list" | "table"`),
  so it's clear what will appear; filtered-empty keeps the real filters and
  tiles above it. Uploads use the drop zone itself as the preview. Errors
  and simple prompts are a plain block, with a danger tile for errors.
- **Scrollbars** are slim and themed (globals.css). Chromium ignores
  `::-webkit-scrollbar` once `scrollbar-color` is set, so the standard
  properties apply only in Firefox.

## 6. Accessibility baseline

- Text-on-`--bg`/`--surface` must hit at least WCAG AA contrast (4.5:1 for
  body text, 3:1 for large text). Check this when you change a token value,
  not just when you add a new component.
- Every form input has an associated `<label>` (visually hidden is fine,
  absent is not).
- Icon-only buttons get an `aria-label`.
