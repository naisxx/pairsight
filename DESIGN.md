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

## 4. Accessibility baseline

- Text-on-`--bg`/`--surface` must hit at least WCAG AA contrast (4.5:1 for
  body text, 3:1 for large text). Check this when you change a token value,
  not just when you add a new component.
- Every form input has an associated `<label>` (visually hidden is fine,
  absent is not).
- Icon-only buttons get an `aria-label`.
