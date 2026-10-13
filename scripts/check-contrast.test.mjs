import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Asserts WCAG 2.1 contrast for every token pairing the UI actually renders,
// in both themes, reading the values straight out of globals.css so the test
// can't drift from the stylesheet. Text needs 4.5:1; control edges, focus
// rings and chart marks need 3:1 (SC 1.4.11). See docs/PairSight-UX-Plan.md §6.

const TEXT = 4.5
const NON_TEXT = 3

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf-8')

// The block whose selector list ends with `selector`: [data-theme='light']
// finds the ":root, [data-theme='light']" block.
function tokens(selector) {
	const start = css.indexOf(`${selector} {`)
	assert.ok(start !== -1, `globals.css has no "${selector}" block`)
	const block = css.slice(start, css.indexOf('}', start))
	const values = Object.fromEntries(
		[...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, hex]) => [name, hex])
	)
	assert.ok(Object.keys(values).length > 20, `"${selector}" block parsed too few tokens`)
	return values
}

const light = tokens("[data-theme='light']")
const themes = { light, dark: { ...light, ...tokens("[data-theme='dark']") } }

function luminance(hex) {
	const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
	const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = [
	'bg',
	'surface',
	'surface-elevated',
	'surface-muted',
	'surface-hover',
	'selected',
	'ghost'
]
const STATUSES = ['success', 'warning', 'danger', 'info']
const CATEGORIES = ['cat-both', 'cat-pairsight', 'cat-vendor', 'cat-neither']

const pairs = [
	...['text', 'text-body', 'text-muted'].flatMap((fg) => SURFACES.map((bg) => [fg, bg, TEXT])),
	['action-ink', 'action', TEXT],
	['action-ink', 'action-active', TEXT],
	// The coral fills the input focus edge and the current step's edge.
	...['bg', 'surface', 'surface-elevated'].map((bg) => ['action', bg, NON_TEXT]),
	['accent-ink', 'accent', TEXT],
	...['bg', 'surface'].map((bg) => ['brand-text', bg, TEXT]),
	...['bg', 'surface'].map((bg) => ['ice-text', bg, TEXT]),
	// The dock and the verdict bar: inverted grounds.
	['on-inverse', 'inverse', TEXT],
	['inverse-brand', 'inverse', TEXT],
	['text', 'accent', TEXT],
	['accent-ink', 'surface', TEXT],
	['text', 'diff', TEXT],
	['diff-ink', 'diff', NON_TEXT],
	['diff-ink', 'surface', NON_TEXT],
	...SURFACES.map((bg) => ['ring', bg, NON_TEXT]),
	...SURFACES.map((bg) => ['focus', bg, NON_TEXT]),
	...SURFACES.map((bg) => ['border-input', bg, NON_TEXT]),
	...STATUSES.flatMap((s) => [
		[s, 'surface', TEXT],
		[s, 'surface-muted', TEXT],
		[s, `${s}-subtle`, TEXT]
	]),
	...CATEGORIES.flatMap((c) => [
		[c, 'surface', NON_TEXT],
		[c, 'bg', NON_TEXT],
		[c, `${c}-subtle`, TEXT]
	]),
	// Chart series are marks, drawn on the panel surface.
	...['series-a', 'series-b'].flatMap((series) => [
		[series, 'surface', NON_TEXT],
		[series, 'surface-muted', NON_TEXT]
	])
]

for (const [theme, values] of Object.entries(themes)) {
	test(`${theme} theme meets WCAG contrast for every rendered pairing`, () => {
		const failures = pairs.flatMap(([fg, bg, minimum]) => {
			assert.ok(values[fg] && values[bg], `${theme}: missing token --${fg} or --${bg}`)
			const actual = ratio(values[fg], values[bg])
			return actual >= minimum ? [] : [`--${fg} on --${bg}: ${actual.toFixed(2)} < ${minimum}`]
		})
		assert.deepEqual(failures, [])
	})
}

// The design's neutrals are paper and charcoal: a faint warmth in light
// mode, near-pure greys in dark. Every channel stays within a few points, so
// a future tweak can't tint the palette (brown, navy) unnoticed.
const NEUTRALS = [
	'bg',
	'surface',
	'surface-elevated',
	'surface-muted',
	'surface-hover',
	'selected',
	'ghost',
	'diff',
	'border',
	'border-input',
	'border-strong',
	'text',
	'text-body',
	'text-muted'
]
const MAX_CHANNEL_SPREAD = 12

for (const [theme, values] of Object.entries(themes)) {
	test(`${theme} theme keeps neutral surfaces and text untinted`, () => {
		const tinted = NEUTRALS.filter((name) => {
			const channels = [1, 3, 5].map((i) => parseInt(values[name].slice(i, i + 2), 16))
			return Math.max(...channels) - Math.min(...channels) > MAX_CHANNEL_SPREAD
		})
		assert.deepEqual(tinted, [])
	})
}

// The brand's third variant is a dimmed vermilion for a control that can't
// be used: quiet next to the live one, but still visibly a button on the
// page. Vermilion is a light colour, so in light mode no tint can sit 3:1
// from it and still read as a button; 2.5:1 is the bar there.
const DISABLED_APART = 2.5

for (const [theme, values] of Object.entries(themes)) {
	test(`${theme} theme keeps the disabled vermilion dim but visible`, () => {
		assert.ok(ratio(values['action-disabled'], values.action) >= DISABLED_APART)
		assert.ok(ratio(values['action-disabled'], values.bg) >= 1.1)
		assert.ok(ratio(values['text-muted'], values['action-disabled']) >= NON_TEXT)
	})
}
