import type { Category } from './decisions'
import type { CategoryCounts } from './metrics'

// The mosaic (pairsight-handoff Foundations): one tile per checked pair, 22
// across, coloured by who says same. "Both say same" fills the middle, the
// vendor's lone merges sit on its left, Jev's lone calls on its right, and
// "both say different" is the ground around them.
export const MOSAIC_COLUMNS = 22
// Past this many pairs (50 rows), one tile stands for several, so a big run
// still fits in its card; the legend says how many.
export const MOSAIC_MAX_TILES = 1_100
// The middle is an ellipse half again as wide as it is tall.
const ELLIPSE_WIDTH = 1.5

export type Mosaic = {
	// Row by row, left to right.
	tiles: Category[]
	// How many pairs one tile stands for.
	perTile: number
}

type Counts = Pick<CategoryCounts, Category>

const CATEGORIES: Category[] = ['both_matched', 'vendor_only', 'pairsight_only', 'neither_matched']

// Each category's share of `tiles`, rounded so the shares add up exactly
// (largest remainder first).
function scaled(counts: Counts, perTile: number, tiles: number): Counts {
	const exact = CATEGORIES.map((category) => ({ category, value: counts[category] / perTile }))
	const result = { both_matched: 0, vendor_only: 0, pairsight_only: 0, neither_matched: 0 }
	for (const { category, value } of exact) result[category] = Math.floor(value)
	let left = tiles - CATEGORIES.reduce((sum, category) => sum + result[category], 0)
	for (const { category } of [...exact].sort(
		(a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value))
	)) {
		if (left <= 0) break
		result[category] += 1
		left -= 1
	}
	return result
}

// The handoff's mos(): tiles nearest the middle take "both say same", then
// the vendor's lone merges fill the left half and Jev's the right (either
// spills over when the other runs out), and the rest is "both say different".
export function mosaicOf(
	counts: Counts,
	{ columns = MOSAIC_COLUMNS, maxTiles = MOSAIC_MAX_TILES } = {}
): Mosaic {
	const pairs = CATEGORIES.reduce((sum, category) => sum + counts[category], 0)
	if (pairs === 0) return { tiles: [], perTile: 1 }
	const perTile = Math.ceil(pairs / maxTiles)
	const total = Math.ceil(pairs / perTile)
	const share = perTile === 1 ? counts : scaled(counts, perTile, total)

	const rows = Math.ceil(total / columns)
	const centreX = (columns - 1) / 2
	const centreY = (rows - 1) / 2
	const cells = Array.from({ length: total }, (_, index) => {
		const x = index % columns
		const y = Math.floor(index / columns)
		return { index, x, distance: Math.hypot((x - centreX) / ELLIPSE_WIDTH, y - centreY) }
	}).sort((a, b) => a.distance - b.distance || a.index - b.index)

	const tiles: Category[] = Array.from({ length: total }, () => 'neither_matched')
	let vendorLeft = share.vendor_only
	let jevLeft = share.pairsight_only
	cells.forEach((cell, rank) => {
		if (rank < share.both_matched) {
			tiles[cell.index] = 'both_matched'
		} else if (cell.x < columns / 2 && vendorLeft > 0) {
			tiles[cell.index] = 'vendor_only'
			vendorLeft -= 1
		} else if (jevLeft > 0) {
			tiles[cell.index] = 'pairsight_only'
			jevLeft -= 1
		} else if (vendorLeft > 0) {
			tiles[cell.index] = 'vendor_only'
			vendorLeft -= 1
		}
	})
	return { tiles, perTile }
}
