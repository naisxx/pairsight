# Prompts for Claude Code

Setup: copy this whole folder into your app's repository as `design/handoff/`, then add the snippet below to the repository's `CLAUDE.md` (create the file if there isn't one). Start Claude Code in the repository root and paste the prompts in order. Review each stage before sending the next.

## Add to CLAUDE.md

```
## Redesign in progress
The app is being restyled to the design in design/handoff/. Read design/handoff/HANDOFF.md before any UI work.
- design/handoff/design/*.dc.html and design/handoff/screenshots/ are the source of truth for look and motion.
- Do not change behaviour, routes, API calls or data. Only presentation and navigation chrome change.
- Every screen must work in light and dark (data-theme on the root).
- The .dc.html files are a spec to port, not code to import. Never add support.js, <x-dc>, <sc-for> or {{holes}} to the app.
```

## Prompt 1: plan (no code yet)

```
Read design/handoff/HANDOFF.md fully, then design/handoff/tokens.css, then Foundations.dc.html, Components.dc.html and Motion.dc.html in design/handoff/design/. Look at the screenshots in design/handoff/screenshots/.

Then explore this app: framework, styling approach, routing, where the layout/sidebar/header live, existing components, and how the dev server and tests are run.

Do not write code yet. Give me:
1. A map of each design file to the route and component files it will change.
2. Screens in the app that have no design, and how you propose to handle each.
3. How you will implement tokens and theming in this project's styling system.
4. How you will implement the scroll-linked animations so they work in Chrome, Safari and Firefox.
5. A staged plan following the build order in HANDOFF.md, with what I will be able to check after each stage.
6. Anything in the brief that conflicts with how the app works.
```

## Prompt 2: foundations and components

```
Do stages 1 and 2 of the plan: tokens, fonts, the theme switch, and the shared components including the top bar and the dock. Replace the existing sidebar and header with them across the app. Don't restyle individual screens yet beyond what the shared layout forces.

When done, run the app, take screenshots of one product screen in light and dark at 1440px wide, compare with the matching files in design/handoff/screenshots/, fix what differs, and tell me what still doesn't match and why.
```

## Prompt 3: product screens (repeat per screen)

```
Restyle the [results overview] screen to match design/handoff/design/[Results].dc.html and screenshots/[results]-light.png and [results]-dark.png. Bind everything to the app's real data, keep all existing behaviour and keyboard shortcuts. Run it, screenshot both themes at 1440px, compare against the design screenshots, and fix differences before you report back. List anything you could not match.
```

Order: Results, Review, Pair, Setup, Records, Vendors, Start, Home, Auth. Then: "Now handle the screens that have no design, as you proposed in the plan."

## Prompt 4: landing page, static

```
Rebuild the landing page to match design/handoff/design/Landing.dc.html, static first: every section in its finished, visible state, both themes, no scroll-linked animation yet. Skip the leftovers listed under "should not be ported" in HANDOFF.md. Compare against screenshots/landing-light.png and landing-dark.png and fix differences.
```

## Prompt 5: landing motion

```
Add the landing page motion, in this order, checking each before the next: load animations and the doubled-word outline; the mosaic vendor switch with its ripple and the auto-switch timer; the pair ticker; the grid background with the cursor glow; bento, bars and figures; then the pinned walkthrough (Narrow, Blind, Open) with the drifting depth tiles and the progress rail.

Timings and ranges are in Motion.dc.html and the keyframes in Landing.dc.html. The walkthrough must work in Chrome, Safari and Firefox. Compare the walkthrough at six scroll positions against screenshots/walkthrough-dark-1..6.png. Then implement prefers-reduced-motion and the under-900px stacked version.
```

## Prompt 6: small screens and final pass

```
Make the landing page match design/handoff/design/Phone.dc.html under 600px (screenshots/phone-light.png, phone-dark.png) and make every product screen usable down to 390px as described in HANDOFF.md. Then do a full pass: keyboard navigation and focus rings, 44px targets, contrast in both themes, reduced motion, Safari and Firefox. Run the test suite. Give me a final list of every place the build differs from the design and every placeholder still open.
```
