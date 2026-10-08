# PairSight design system

PairSight's palette: brand coral (with `#972828`, `#EB7F31` and `#FCAD38`
for decoration) on pure neutral greys, untinted in light and dark. The
system around it (surfaces, hierarchy, type scale, radii, depth) follows
ClickHouse's design language, kept to our colours and fonts. The full UI/UX
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

The one exception is the PDF summary report: a PDF can't read CSS
variables, so `src/server/pairsight/report-pdf/styles.ts` copies the light
theme's values as hex and uses the PDF's built-in Helvetica. Change a token
here, change it there.

## 2. Name tokens by role, not by value

`--action`, not `--coral-500`. A rename should never cascade through every
component that uses it. Values for both themes live in `globals.css`; the
measured contrast for each is in the UX plan §6.

| Token                                                                             | Role                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--bg`                                                                            | Page background                                                                                                    |
| `--surface` / `--surface-elevated` / `--surface-muted`                            | Cards and tables / menus and dialogs / table headers and sunken areas                                              |
| `--surface-hover`                                                                 | Hover state for rows, menu items and interactive surfaces                                                          |
| `--selected`                                                                      | Selected row, current step, chosen option — always with a coral edge or outline, never a brand tint                |
| `--ghost`                                                                         | Ghost button at rest                                                                                               |
| `--diff` / `--diff-ink`                                                           | A changed value in pair detail and its ≠ marker (a difference, not a warning)                                      |
| `--border`                                                                        | Decorative hairlines only — too faint for a control edge                                                           |
| `--border-input`                                                                  | Form controls and any essential boundary (≥ 3:1 on every surface)                                                  |
| `--text` / `--text-muted`                                                         | Primary / secondary text (muted also covers placeholders; there is no fainter text token)                          |
| `--action` / `--action-active` / `--action-disabled` / `--action-ink`             | The brand's three variants (below), and the text on them                                                           |
| `--accent` / `--accent-ink`                                                       | Small brand chips only (never a large area: coral over dark slate turns maroon) / links and active text            |
| `--ring`                                                                          | Coral marks: the threshold on score bars and charts                                                                |
| `--focus`                                                                         | Keyboard focus (blue, so a focused field never reads as an error)                                                  |
| `--success` / `--warning` / `--danger` / `--info` (+ `-subtle`)                   | Status only, never decoration; always with an icon or label. Danger's hue is kept 25° from the brand               |
| `--cat-both` / `--cat-pairsight` / `--cat-vendor` / `--cat-neither` (+ `-subtle`) | The four comparison categories. They mean **agreement, not correctness**, so they never use brand or status colors |
| `--brand-deep` / `--brand-orange` / `--brand-amber`                               | Decorative brand only (wordmark, landing). Never status or data                                                    |
| `--color-brand`                                                                   | The logo's coral, fixed in both themes. The mark only                                                              |
| `--series-a` / `--series-b`                                                       | Chart series that aren't categories (metrics, vendors side by side)                                                |
| `--shadow` (`shadow-elevated`)                                                    | Anything floating above the page: menus, popovers, tooltips, dialogs, toasts. Never cards                          |

**The brand is exactly three variants**, the way ClickHouse uses its yellow:

- `--action`, the coral: primary buttons, the number a headline turns on
  (the verdict's leader, the Plan's pair count), the current step's edge and
  ring, the input focus edge, the chosen vendor card, "Closer to Jev", and
  the landing's closing band.
- `--action-active`: hover and press, a step darker.
- `--action-disabled`: a dimmed coral for a primary action that can't be
  used yet, with muted text on it.

Nothing else is tinted with the brand. `--accent` / `--accent-ink` (links,
small chips, coral numbers in text) and the decorative `--brand-*`,
`--headline-*` and glows are separate and unchanged.

**Neutrals are pure greys** (every channel within 2 points, tested), so dark
mode reads as near-black, never navy or sepia. Depth is the surface ladder
(`bg` → `surface-muted` → `surface` → `surface-elevated`) plus 1 px hairlines,
not shadows.

shadcn/ui's variable names (`--background`, `--primary`, `--muted`, …) are
aliases of these in `globals.css`, so copied shadcn components work unmodified.
Change values in the PairSight tokens, never in the aliases.

Themes are class-based: `next-themes` sets `.dark` on `<html>` from the
Light / Dark / System menu (`src/components/pairsight/theme-menu.tsx`), with no
flash on load. Use `dark:` variants only for things tokens can't express.

## 3. Component conventions

- Build variant components (buttons, chips — anything with more
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

- **Space Grotesk** (variable, 400–700) is the interface: headings, labels,
  prose, buttons, chips.
- **JetBrains Mono** is the data voice: anything the user reads _exactly_
  rather than skims.

Components use the named roles in `globals.css`, never raw `text-sm` /
`text-xs`, so a heading or a label looks the same on every screen. Colour
stays a separate class (`text-text`, `text-text-muted`, …).

| Role              | Spec                                       | Use                                                                   |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `type-display-xl` | 40 → 72 px on `md`, 700, tracking −0.035em | The landing hero                                                      |
| `type-display-lg` | 40 → 56 px, 700                            | The landing's closing band                                            |
| `type-display-md` | 30 → 40 px, 700                            | The Results verdict, landing section headings                         |
| `type-display-sm` | 26 → 32 px, 700                            | Page titles (`StepHeader`, Evaluations, auth, error pages)            |
| `type-title`      | 22 / 30, 700 (24 / 32 on `md`)             | Section titles, the pair page                                         |
| `type-heading`    | 18 / 26, 600                               | Card (`Panel`) and dialog titles                                      |
| `type-subheading` | 16 / 24, 600                               | Headings inside a card                                                |
| `type-eyebrow`    | 12 / 16, 600, uppercase, +0.125em          | The small label over a section or card ("Current evaluation")         |
| `type-body`       | 14 / 22, 400                               | Prose                                                                 |
| `type-label`      | 14 / 20, 500                               | Form labels                                                           |
| `type-ui`         | 13 / 20, 400                               | Controls, navigation, menus, table text — the default inside a screen |
| `type-meta`       | 12 / 18, 400                               | Hints and relative times                                              |
| `type-caption`    | 11 / 16, 400                               | Sidebar captions, pipeline summaries, small chart labels              |
| `type-data-sm`    | JetBrains Mono 12 / 18                     | A value in the data voice where `font-mono` alone isn't enough        |

Big numbers (a vendor's agreement, the cut-off, the Plan's counts) are
JetBrains Mono at display size. Other values in the data voice are
`font-mono` at the size around them: `.font-mono` turns on tabular figures
everywhere (globals.css), so numbers line up without a special role.

**Where the mono goes, and why:**

- **Data values:** record references, raw values in pair detail (so `Smith`
  vs `Smyth` is compared character by character), CSV headers and sample rows
  in the column mapping, file names.
- **Numbers that align or move:** the interface face's digits shift as they
  change, so scores, plan counts and live run counters use the
  mono roles; otherwise columns misalign and counters jitter as they tick.
  Numbers inside a sentence ("Run 2 · 8 pairs") stay in Space Grotesk.
- **Keyboard hints:** `J` `K` `Esc` as key caps, with the `Kbd` component.

Never use the mono for headings, buttons, category names or prose.

## 5. Layout and spacing

Signed-in pages use the app shell (`src/components/pairsight/shell/`); the UX
plan §3 describes its behaviour. Spacing follows one system so every screen
lines up:

| Thing                   | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Grid                    | Tailwind's 4 px scale                                                  |
| Top bar, sidebar header | 52 px                                                                  |
| Page column             | max 1280 px (1440 px on Results and Pair), centred                     |
| Page padding            | 32 px (`px-8`), 16 px on phones; 40 px top (28 on phones)              |
| Between cards           | 16 px (`gap-4`, `space-y-4`)                                           |
| Inside a card           | 24 px (`p-6`), 20 px on phones                                         |
| Controls                | 40 px (`h-10`), 32 px small (`h-8`)                                    |
| Radii                   | 6 px small, 8 px buttons and inputs, 12 px cards, pills for chips only |
| Table rows              | 56 px in lists, 40 px in dense tables                                  |
| Sidebar                 | 256 px expanded, 60 px collapsed, a 280 px drawer on phones            |

- **The page column is centred and capped** (`.page-frame`, 1280 px); a page
  that sets `data-wide-page` (Results, Pair) widens it to 1440 px. The page
  scrolls inside `<main>`, not the window.
- **Everything in the sidebar sits on one centre line** in both widths (icons,
  pipeline nodes, the avatar), so collapsing never shifts them.
- **The action bar** docks to the bottom of the page column, edge to edge: it
  rests at the bottom of a short page and stays in view on a long one. Back
  sits on the left; the primary action on the right, with the reason it's
  blocked beside it (and `aria-describedby` pointing at that reason).
- **Grids that change column count** always declare a shrinkable column at
  every size (`grid-cols-1`), or a wide table widens the page instead of
  scrolling.
- **Inside the app, layouts respond to the page's width, not the window's.**
  The sidebar takes up to 256 px, so a 1024 px window leaves the page about
  780 px. Use container variants there (`@2xl:` / `@3xl:` / `@5xl:` /
  `@6xl:`, roughly where `sm:` / `md:` / `lg:` / `xl:` sit); keep viewport
  ones (`md:`) for the shell itself, the landing and the auth pages.
- **A table that scrolls sideways** gets `scroll-fade-x`, which fades the
  edge with more to show, and a focusable wrapper so the keyboard can
  scroll it.
- **The shell sits on the canvas:** the sidebar and top bar are `bg`, divided
  from the page by hairlines; cards are the only raised surfaces. The
  current step is a coral ring and a coral inset edge.
- **Cards** are hairline-bordered surfaces with no shadow (`Panel`, or the
  same classes: `rounded-lg border border-border bg-surface`) with a
  `type-heading` title and one muted line under it. Icons never get colour
  except for status; active and selected states use the `solid` variant.
- **Choosing one of a few** (`Segmented`): a track with the chosen option as
  a solid coral pill and the rest as quiet text. `isFill` spreads two-line
  options (a name over its value) across the full width.
- **The match cut-off** is drawn with `CutoffScale`: Jev's 0–1 scale with
  where scores fell in our tests shaded (clearly different at the low end,
  true matches at the high end, `SCORE_BANDS`) and a coral pin carrying the
  value. It is a picture only; the value is always said in words beside it.
- **Empty states** use `EmptyState` (`src/components/pairsight/empty-state.tsx`)
  with a drawn scene from `empty/scenes.tsx`: small pictures built from the
  product's own parts (record cards, file cards, score bars) in tokens, so
  they work in both themes, arriving with the `rise` stagger. Then a short
  title, one line of explanation and the next action. Never a flat icon in a
  square. Errors are a `danger-subtle` block with a warning icon.
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
- On touch screens every tap target is at least 44 × 44 px. Controls with
  a size scale grow under the `pointer-coarse:` variant (Button `sm`,
  `default` and icon sizes, inputs, selects, segmented options, menu
  rows). Anything that should keep its look (an (i) tip, a checkbox, an
  inline text link, a slider thumb) takes the `hit-area` utility instead:
  an invisible `::after` at least 44 px each way, centred on it. It can't
  grow out of an `overflow: hidden` box (a truncated link), so those take
  padding under `pointer-coarse:` instead.
- On a narrow screen, a detail chosen from a list opens in a bottom
  sheet (`src/components/ui/sheet.tsx`, a Radix dialog: focus trapped and
  returned, Esc and the scrim close it), not below the list.
- Keyboard shortcuts are listed on `?` (`results/shortcuts-dialog.tsx`)
  and declared on their controls with `aria-keyshortcuts`.

## 7. Motion

Things arrive; they don't pop. `src/app/motion.css` holds it all, in CSS,
so server components animate without becoming client ones:

- One curve, `--ease-out-soft`: fast out, gentle settle.
- `rise` (fade, lift and a little blur) with `stagger-N` to order a group;
  `rise-gentle` for small things like sidebar steps. App pages need nothing:
  each section of `.page-frame` rises a beat after the one before.
- Number tiles count up from zero on first sight (`AnimatedNumber`), and
  score bars fill from the left. A selected pair's score counts up quicker
  (`AnimatedScore`, 0.5 s) and its panel cross-fades in. While the cut-off
  is previewed, every figure tweens from what's on screen to its new value.
- A bottom sheet slides up (`sheet-in`) and back down (`sheet-out`).
- The landing page is the one place for show, and the one place motion is
  driven by script: Motion (`motion/react`, through `LazyMotion`) and Lenis
  for smooth wheel scrolling, both set up in
  `src/components/pairsight/landing/landing-motion.tsx`. The hero arrives
  once, in sequence (a fade and a 14 px rise, 0.7 s); every block below
  fades and rises into place the first time it scrolls into view (0.6 s,
  once). Section headings fill in word by word as they scroll up the page,
  the nav's thin bar tracks how far down you are, and "How it works" pins
  while its three steps play. No blur on text, ever. The headline accent is
  the static brand gradient (`text-gradient`, `--headline-*`, darker in
  light mode to keep 3:1).
- Results charts draw over a second once their card has arrived, and its
  bars wipe in from the left (`bar-wipe`).
- Dialogs ease in and fade back out, a little quicker. Anything that
  expands (a run card's details) eases its height open (`grid-rows-[0fr]` →
  `[1fr]`) instead of popping, and stays inert while closed.
- Every animation sits inside `prefers-reduced-motion: no-preference`.
  With reduced motion, everything is simply there: on the landing, Motion
  skips movement, Lenis tracks the wheel one to one, headings are filled
  and "How it works" is a plain list.

## 8. Deferred: Glass

A frosted, translucent second style (Glass) shipped once and is deferred:
there's one style now, and nothing reads a `data-ui` attribute or a style
cookie. If it comes back, it only redefines the surface, border and
backdrop tokens, so components need no changes.
