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
| `--action` / `--action-hover` / `--action-ink`                                    | The primary action: deeper coral with white ink in light, brighter coral with near-black ink in dark               |
| `--accent` / `--accent-ink`                                                       | Small brand chips only (never a large area: coral over dark slate turns maroon) / links and active text            |
| `--ring`                                                                          | Coral marks: the threshold on score bars and charts                                                                |
| `--focus`                                                                         | Keyboard focus (blue, so a focused field never reads as an error)                                                  |
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

- **Poppins** (400 / 500 / 600) is the interface: headings, labels, prose,
  buttons, chips.
- **JetBrains Mono** is the data voice: anything the user reads _exactly_
  rather than skims.

Components use the named roles in `globals.css`, never raw `text-sm` /
`text-xs`, so a heading or a label looks the same on every screen. Colour
stays a separate class (`text-text`, `text-text-muted`, …).

| Role              | Spec                                   | Use                                                                   |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `type-title`      | Poppins 22 / 30, 600 (24 / 32 on `md`) | Page titles (`StepHeader`, Evaluations)                               |
| `type-heading`    | Poppins 16 / 24, 600                   | Dialog titles                                                         |
| `type-subheading` | Poppins 14 / 20, 600                   | Headings inside a card                                                |
| `type-body`       | Poppins 14 / 22, 400                   | Prose                                                                 |
| `type-label`      | Poppins 14 / 20, 500                   | Form labels                                                           |
| `type-ui`         | Poppins 13 / 20, 400                   | Controls, navigation, menus, table text — the default inside a screen |
| `type-meta`       | Poppins 12 / 18, 400                   | Hints and relative times                                              |
| `type-caption`    | Poppins 11 / 16, 400                   | Sidebar captions, pipeline summaries, small chart labels              |
| `type-data-sm`    | JetBrains Mono 12 / 18                 | A value in the data voice where `font-mono` alone isn't enough        |

Card titles are `text-sm font-semibold`, and values in the data voice are
`font-mono` at the size around them: `.font-mono` turns on tabular figures
everywhere (globals.css), so numbers line up without a special role.

**Where the mono goes, and why:**

- **Data values:** record references, raw values in pair detail (so `Smith`
  vs `Smyth` is compared character by character), CSV headers and sample rows
  in the column mapping, file names.
- **Numbers that align or move:** Poppins' digits are proportional (a `1` is
  half the width of a `0`) and it has no tabular figures, so `tabular-nums`
  does nothing. Scores, plan counts and live run counters use the
  mono roles; otherwise columns misalign and counters jitter as they tick.
  Numbers inside a sentence ("Run 2 · 8 pairs") stay in Poppins.
- **Keyboard hints:** `J` `K` `Esc` as key caps, with the `Kbd` component.

Never use the mono for headings, buttons, category names or prose.

## 5. Layout and spacing

Signed-in pages use the app shell (`src/components/pairsight/shell/`); the UX
plan §3 describes its behaviour. Spacing follows one system so every screen
lines up:

| Thing                   | Value                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Grid                    | Tailwind's 4 px scale                                       |
| Top bar, sidebar header | 48 px (`h-12`)                                              |
| Page column             | max 1280 px (1440 px on Results and Pair), centred          |
| Page padding            | 32 px (`px-8`), 16 px on phones; 24 px top                  |
| Between cards           | 16 px (`gap-4`, `space-y-4`)                                |
| Inside a card           | 16–20 px (`p-4` / `px-5`)                                   |
| Controls                | 36 px (`h-9`), 32 px small (`h-8`)                          |
| Table rows              | 56 px in lists, 40 px in dense tables                       |
| Sidebar                 | 248 px expanded, 60 px collapsed, a 280 px drawer on phones |

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
  The sidebar takes up to 248 px, so a 1024 px window leaves the page about
  780 px. Use container variants there (`@2xl:` / `@3xl:` / `@5xl:` /
  `@6xl:`, roughly where `sm:` / `md:` / `lg:` / `xl:` sit); keep viewport
  ones (`md:`) for the shell itself, the landing and the auth pages.
- **A table that scrolls sideways** gets `scroll-fade-x`, which fades the
  edge with more to show, and a focusable wrapper so the keyboard can
  scroll it.
- **Cards** are hairline-bordered surfaces (`Panel`, or the same classes:
  `rounded-md border border-border bg-surface`) with a small semibold title
  and one muted line under it. Icons never get colour except for status;
  active and selected states use the `solid` variant.
- **Empty states** are a plain block inside the card that would hold the
  content: a muted 40 px icon square, a short title, one line of
  explanation and the next action. Uploads use the drop zone itself.
  Errors are a `danger-subtle` block with a warning icon.
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

## 7. Motion

Things arrive; they don't pop. `src/app/motion.css` holds it all, in CSS,
so server components animate without becoming client ones:

- One curve, `--ease-out-soft`: fast out, gentle settle.
- `rise` (fade, lift and a little blur) with `stagger-N` to order a group;
  `rise-gentle` for small things like sidebar steps. App pages need nothing:
  each section of `.page-frame` rises a beat after the one before.
- Number tiles count up from zero on first sight (`AnimatedNumber`), and
  score bars fill from the left.
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

## 8. UI style: Classic or Glass

A second look, chosen in the Theme menu under Style and kept in a cookie
(`src/lib/ui-style.ts`), so the server puts `data-ui` on `<html>` and the first
paint is right. **Glass** (`src/app/glass.css`) only redefines the surfaces,
borders and page backdrop:

- **Panels:** translucent, and frosted with a backdrop blur.
- **Edge:** cards get a fine light line along the top.
- **Backdrop:** a soft coral, periwinkle and amber wash behind everything.

Text and accent tokens are untouched, so contrast holds; axe passes in both
themes. With the OS's "reduce transparency" on, Glass falls back to solid
surfaces. Both styles ship; Classic is the default. A component never needs
to know which is on: use the surface tokens (`bg-surface`, `bg-surface-muted`,
`bg-surface-elevated`) and Glass applies itself.
