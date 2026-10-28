# PairSight redesign: handoff brief

This folder is the complete design for the PairSight revamp. Your job is to make the running app look and move like these designs, in light and dark, without changing what the app does or the data it shows.

## What is in this folder

| Path | What it is | How to use it |
|---|---|---|
| `design/*.dc.html` | One file per screen or board. Each holds the exact markup, CSS and keyframes. | **Read as a spec and port.** They are written for a design-canvas runtime (`support.js`, `<x-dc>`, `{{holes}}`, `<sc-for>`, `<sc-if>`) and do not run on their own. Do not copy that runtime. The CSS, class structure, values and timings are exact and should be carried over. |
| `screenshots/*.png` | Each screen rendered at 1440px (phone at 390px), light and dark. `walkthrough-*-1..6.png` are the landing walkthrough at six scroll positions. | The visual target. Compare your build against these. |
| `tokens.css` | All colour, type, radius, spacing and easing tokens for both themes. | Start here. Adapt to the project's styling system (CSS variables, Tailwind theme, etc.). |
| `PROMPT.md` | The prompts to give Claude Code, stage by stage. | For the person running the build. |

Template syntax in the design files: `{{name}}` is a value from the `renderVals()` function in the script at the bottom of the same file; `<sc-for list as>` repeats its children; `<sc-if value>` shows them conditionally; `onClick="{{fn}}"` is a handler. The script block shows the state each screen needs.

## Screen map

| Design file | Screen | Notes |
|---|---|---|
| `Landing.dc.html` | Marketing landing page | Dark by default, theme switch in the nav |
| `Phone.dc.html` | Landing page under ~600px | Simplified: no cursor glow, no ticker, no pinned scroll |
| `Auth.dc.html` | Sign up / sign in | One screen, two modes |
| `Home.dc.html` | Evaluations list (demo home) | |
| `Records.dc.html` | Pipeline step 1 | |
| `Vendors.dc.html` | Pipeline step 2 | |
| `Setup.dc.html` | Pipeline step 3, "What Jev checks" | |
| `Start.dc.html` | Pipeline step 4, "Check and start" | |
| `Results.dc.html` | Step 5, results overview | |
| `Review.dc.html` | Step 5, pair list with preview panel | |
| `Pair.dc.html` | Step 5, single pair comparison | |
| `Foundations.dc.html` | Design system: marks, colour, type, shape | Read first |
| `Components.dc.html` | Design system: every component in both themes | Read second |
| `Motion.dc.html` | Design system: every animation with timings, plus build notes | Read third |

Find the matching route for each screen in the existing app. Where the app has a screen with no design here (settings, runs list, error and empty states, loading states), build it from the same components and tokens and list what you did.

## Rules

1. **Behaviour and data stay as they are.** Routes, API calls, state, validation, keyboard shortcuts and copy that carries meaning are not to change unless a design shows a change. The numbers in the designs are demo data; bind to the app's real data.
2. **The navigation changes.** The sidebar and the old header are replaced by a slim top bar and **the dock**: a floating bar fixed 20px above the bottom of the window holding the five pipeline steps and the current screen's next action (Back / Continue in setup; Overview / Pairs / Download in results). Spec: `.dock`, `.st`, `.dact` in any product screen file, and the Components board. Leave bottom padding on pages so the dock never covers the last content.
3. **Both themes everywhere.** Theme is a `data-theme` attribute on the root. Product default is light, landing default is dark. Persist the user's choice and respect `prefers-color-scheme` on first visit.
4. **Three typefaces, loaded properly:** Bricolage Grotesque (600), Instrument Sans (400/500/600), JetBrains Mono (400/600). Self-host or use the framework's font loader. Anything a person compares character by character is in the mono.
5. **Brand marks:** the logo is three tiles (vermilion, text colour, ice). The mosaic is one tile per checked pair, 22 columns, coloured ink = both say same, vermilion = only the vendor, ice = only the checker, rule grey = both say different. The tile ordering algorithm is the `mos()` function in `Results.dc.html`. Keep it; with real data pass real counts and scale the grid to the real pair count (keep 22 columns, add rows; above a few thousand pairs, bucket so one tile stands for N pairs and say so in the legend).
6. **Accessibility:** every interactive target at least 44px, visible focus rings (2px ice-text, 3px offset), text contrast 4.5:1 or better, real `<button>` and `<a>` elements, decorative visuals `aria-hidden`.
7. **Placeholders:** text in `[SQUARE BRACKETS]` is content the designer did not have (legal name, cost estimate, run time, file limits, some demo values). Use the app's real value, or leave a clearly marked TODO and list it.

## Motion

The full list with timings is the table in `Motion.dc.html`; the keyframes are in `Landing.dc.html`. Key points:

- **Scroll-linked effects.** The design uses CSS scroll timelines (`animation-timeline: view()` and a named `--st` view timeline with `animation-range: contain X% contain Y%`). These run in Chromium only. **Build them so they work in Safari and Firefox too:** drive the same keyframe progress from scroll position in script (a small scroll-progress hook, or a library the project already uses such as GSAP ScrollTrigger or Motion). Each scene's start and end percentages in the CSS are the spec.
- **The walkthrough** (`.story`): pinned for 6,200px of scroll, three scenes (Narrow, Blind, Open) at roughly 0–33%, 34–66%, 67–100%. See `walkthrough-*.png`. Under 900px it is not pinned: the three scenes stack in their finished state.
- **Grid glow** (`.bg-grid`): a 48px grid of hairlines and dots; two masked copies light up around the pointer (vermilion within 240px, ice within 480px). One pointer listener writes two CSS variables. It must not go through component state or re-render anything. Hidden behind the header, the ticker and the footer.
- **Mosaic ripple:** on vendor switch each tile transitions its colour with a delay of 40ms times its distance from the centre.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no animation or transition; everything shows its finished state.
- **Product screens:** nothing loops and nothing runs longer than 240ms.

Unused leftovers in `Landing.dc.html` that should **not** be ported: the `.lp`/`.ln` lens background, `.bg-silk`, `.bg-moire`, `.bg-curt`, `.bg-scan`, the non-`plan` grid variants, the `.venn`/circle hero, the seam (`.zp`) hero, `.fcard`, `.c3`, and `data-pal` variants other than `ice`. The live choices are: palette ice, hero mosaic, background grid `plan` ("lines and dots").

## Build order

1. Tokens, fonts, theme switch.
2. Shared components (two-part button, outline button, chips, glyph tiles, cards, segmented control, inputs, keycaps, mosaic, logo, top bar, dock).
3. Product screens: Results, Review, Pair, Setup, Records, Vendors, Start, Home, Auth.
4. Landing page, static, both themes.
5. Landing motion: load animations, mosaic switch, ticker, grid glow, bento and figures, then the walkthrough last.
6. Small screens (`Phone.dc.html` for the landing; product screens reflow: cards stack, the dock keeps only the current step's label under 900px).
7. Pass for reduced motion, keyboard, focus, contrast, and Safari/Firefox.

After each stage: run the app, screenshot the result at 1440px in both themes, compare against `screenshots/`, and fix differences before moving on.

## Known gaps

- No designs for: settings/account, the runs list, loading, empty and error states, run-in-progress. Build from the system and report.
- Product screens were designed at 1440px only; small-screen behaviour is described above, not drawn.
- The supplier evaluation on the demo home has placeholder vendor names and scores.
