import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Category } from './decisions'
import { MOSAIC_COLUMNS, mosaicOf } from './mosaic'

function tally(tiles: Category[]) {
	const counts: Record<string, number> = {}
	for (const tile of tiles) counts[tile] = (counts[tile] ?? 0) + 1
	return counts
}

const DESIGN = { both_matched: 158, vendor_only: 44, pairsight_only: 42, neither_matched: 42 }

test('one tile per pair, every pair counted once', () => {
	const { tiles, perTile } = mosaicOf(DESIGN)
	assert.equal(perTile, 1)
	assert.equal(tiles.length, 286)
	assert.deepEqual(tally(tiles), DESIGN)
})

test('both say same fills the middle; the vendor’s lone merges lean left, Jev’s right', () => {
	const { tiles } = mosaicOf(DESIGN)
	const rows = tiles.length / MOSAIC_COLUMNS
	const middle = Math.floor(rows / 2) * MOSAIC_COLUMNS + MOSAIC_COLUMNS / 2
	assert.equal(tiles[middle], 'both_matched')
	const column = (index: number) => index % MOSAIC_COLUMNS
	const sides = (category: Category) => {
		const columns = tiles.flatMap((tile, index) => (tile === category ? [column(index)] : []))
		return columns.reduce((sum, value) => sum + value, 0) / columns.length
	}
	assert.ok(sides('vendor_only') < MOSAIC_COLUMNS / 2)
	assert.ok(sides('pairsight_only') > MOSAIC_COLUMNS / 2)
	// The corners are the ground.
	assert.equal(tiles[0], 'neither_matched')
	assert.equal(tiles.at(-1), 'neither_matched')
})

test('a lone category spills to the other side when the other runs out', () => {
	const { tiles } = mosaicOf({
		both_matched: 0,
		vendor_only: 100,
		pairsight_only: 0,
		neither_matched: 0
	})
	assert.deepEqual(tally(tiles), { vendor_only: 100 })
})

test('a big run is bucketed: one tile stands for several pairs, shares kept', () => {
	const counts = {
		both_matched: 6001,
		vendor_only: 1500,
		pairsight_only: 999,
		neither_matched: 1500
	}
	const { tiles, perTile } = mosaicOf(counts, { maxTiles: 900 })
	assert.equal(perTile, 12)
	assert.equal(tiles.length, Math.ceil(10_000 / 12))
	const shown = tally(tiles)
	for (const [category, count] of Object.entries(counts)) {
		assert.ok(Math.abs((shown[category] ?? 0) - count / perTile) < 1, category)
	}
})

test('no checked pairs, no tiles', () => {
	assert.deepEqual(
		mosaicOf({ both_matched: 0, vendor_only: 0, pairsight_only: 0, neither_matched: 0 }),
		{ tiles: [], perTile: 1 }
	)
})
