// Renders the installer's artwork (deploy/windows/pairsight.iss) from the
// app's own colours (src/app/globals.css) and wordmark font, in light and
// dark, at each size Windows asks for as its scaling goes from 100% to 250%:
//
// - wizard-<theme>-<width>.png: beside the Welcome and Finished pages, a
//   mosaic of the mark's tiles above the wordmark;
// - mark-<theme>-<width>.png: the mark, top right of every other page.
//
// Transparent, so they sit on the installer's own background colour. Rerun
// after changing the brand colours, then commit the PNGs:
//
//   node deploy/windows/art/render.mjs

import { chromium } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.dirname(fileURLToPath(import.meta.url))

// The tokens the art uses, per theme, as in globals.css.
const THEMES = {
	light: { text: '#0d0d0e', brand: '#ff4a1c', ice: '#a9cadb', muted: '#dddbd4' },
	dark: { text: '#f4f3f0', brand: '#ff4a1c', ice: '#bfd9e6', muted: '#2a2a2e' }
}

// Inno Setup's image areas at 100%, 125%, 150%, 200% and 250% scaling: it
// picks the closest file.
const WIZARD = { width: 202, height: 386, widths: [202, 269, 336, 430, 534] }
const MARK = { size: 58, widths: [58, 77, 97, 124, 159] }

const GRID_COLUMNS = 7
const GRID_ROWS = 10
// How often each tile is the mark's colours rather than a quiet one: mostly
// agreement (the text colour), some vendor (vermilion) and checker (ice).
const TILE_WEIGHTS = [
	['muted', 0.42],
	['text', 0.3],
	['ice', 0.16],
	['brand', 0.12]
]

// The same mosaic on every render: a fixed seed, not Math.random.
function seededRandom(seed) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) % 2 ** 32
		return state / 2 ** 32
	}
}

function tileColours() {
	const random = seededRandom(7)
	return Array.from({ length: GRID_COLUMNS * GRID_ROWS }, () => {
		let roll = random()
		for (const [colour, weight] of TILE_WEIGHTS) {
			roll -= weight
			if (roll <= 0) return colour
		}
		return 'muted'
	})
}

// The mark (src/components/pairsight/wordmark.tsx): vendor, agreement, checker.
function glyph(tile, gap) {
	const tiles = ['brand', 'text', 'ice']
		.map((colour) => `<i style="width:${tile}px;height:${tile}px;background:var(--${colour})"></i>`)
		.join('')
	return `<span class="glyph" style="gap:${gap}px">${tiles}</span>`
}

function page(theme, body) {
	const vars = Object.entries(THEMES[theme])
		.map(([name, value]) => `--${name}:${value}`)
		.join(';')
	return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600&display=block">
<style>
	:root { ${vars} }
	html, body { margin: 0; background: transparent; }
	.glyph { display: inline-flex; }
	.glyph i { display: block; border-radius: 25%; }
</style></head><body>${body}</body></html>`
}

function wizard(theme) {
	const tiles = tileColours()
		.map((colour, index) => {
			// Fades towards the wordmark, row by row.
			const row = Math.floor(index / GRID_COLUMNS)
			const opacity = (1 - (row / GRID_ROWS) * 0.8).toFixed(2)
			return `<i style="background:var(--${colour});opacity:${opacity}"></i>`
		})
		.join('')
	return page(
		theme,
		`<style>
			.panel { width: ${WIZARD.width}px; height: ${WIZARD.height}px; box-sizing: border-box; padding: 24px 20px; display: flex; flex-direction: column; justify-content: space-between; }
			.mosaic { display: grid; grid-template-columns: repeat(${GRID_COLUMNS}, 18px); gap: 6px; }
			.mosaic i { display: block; width: 18px; height: 18px; border-radius: 4px; }
			.wordmark { display: flex; align-items: center; gap: 9px; color: var(--text); font: 600 24px/1 'Bricolage Grotesque', sans-serif; letter-spacing: -0.025em; }
		</style>
		<div class="panel"><div class="mosaic">${tiles}</div>
		<div class="wordmark">${glyph(10, 3)}<span>PairSight</span></div></div>`
	)
}

function mark(theme) {
	return page(
		theme,
		`<div style="width:${MARK.size}px;height:${MARK.size}px;display:flex;align-items:center;justify-content:center">${glyph(13, 4)}</div>`
	)
}

const browser = await chromium.launch()
try {
	for (const theme of Object.keys(THEMES)) {
		for (const [name, html, base, widths] of [
			['wizard', wizard(theme), { width: WIZARD.width, height: WIZARD.height }, WIZARD.widths],
			['mark', mark(theme), { width: MARK.size, height: MARK.size }, MARK.widths]
		]) {
			for (const width of widths) {
				const context = await browser.newContext({
					viewport: base,
					deviceScaleFactor: width / base.width
				})
				const tab = await context.newPage()
				await tab.setContent(html, { waitUntil: 'networkidle' })
				await tab.evaluate(() => document.fonts.ready)
				const file = path.join(OUT, `${name}-${theme}-${width}.png`)
				await tab.screenshot({ path: file, omitBackground: true })
				await context.close()
				console.log(path.relative(process.cwd(), file))
			}
		}
	}
} finally {
	await browser.close()
}
