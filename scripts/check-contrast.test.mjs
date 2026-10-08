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

const light = tokens(':root')
const themes = { light, dark: { ...light, ...tokens('.dark') } }

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
	...['text', 'text-muted'].flatMap((fg) => SURFACES.map((bg) => [fg, bg, TEXT])),
	['action-ink', 'action', TEXT],
	['action-ink', 'action-active', TEXT],
	// The coral fills the input focus edge and the current step's edge.
	...['bg', 'surface', 'surface-elevated'].map((bg) => ['action', bg, NON_TEXT]),
	['accent-ink', 'accent', TEXT],
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

// Dark mode once read as "night mode" (warm brown), then as navy (blue
// tinted). Neutrals are pure greys now: every channel within a couple of
// points, so a future tweak can't tint the palette either way unnoticed.
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
	'text',
	'text-muted'
]
const MAX_CHANNEL_SPREAD = 2

for (const [theme, values] of Object.entries(themes)) {
	test(`${theme} theme keeps neutral surfaces and text untinted`, () => {
		const tinted = NEUTRALS.filter((name) => {
			const channels = [1, 3, 5].map((i) => parseInt(values[name].slice(i, i + 2), 16))
			return Math.max(...channels) - Math.min(...channels) > MAX_CHANNEL_SPREAD
		})
		assert.deepEqual(tinted, [])
	})
}

// The brand's third variant is a dimmed coral for a control that can't be
// used: quiet next to the live coral, but still visibly a button on the page.
for (const [theme, values] of Object.entries(themes)) {
	test(`${theme} theme keeps the disabled coral dim but visible`, () => {
		assert.ok(ratio(values['action-disabled'], values.action) >= NON_TEXT)
		assert.ok(ratio(values['action-disabled'], values.bg) >= 1.1)
		assert.ok(ratio(values['text-muted'], values['action-disabled']) >= NON_TEXT)
	})
}
