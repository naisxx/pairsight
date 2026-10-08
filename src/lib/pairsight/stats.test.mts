import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AssessmentStatus } from './decisions'
import { histogram, sensitivity, vendorMetrics, workload } from './metrics'
import {
	binPairs,
	scoreBin,
	statsCoverage,
	statsHeadToHead,
	statsHistogram,
	statsMetrics,
	statsMetricsAt,
	statsSensitivity,
	statsWorkload
} from './stats'

// Seeded so a failure is repeatable.
function random(seed: number) {
	let state = seed
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
		return state / 2_147_483_648
	}
}

const VENDORS = ['v1', 'v2', 'v3']
const STATUSES: AssessmentStatus[] = ['succeeded', 'succeeded', 'succeeded', 'pending', 'failed']

function samplePairs(count: number, seed: number) {
	const next = random(seed)
	return Array.from({ length: count }, (_, index) => {
		const status = STATUSES[Math.floor(next() * STATUSES.length)] ?? 'succeeded'
		// Scores right on 0.01 and 0.05 edges, where binning could go wrong.
		const edge = next() < 0.3
		const score =
			status === 'succeeded'
				? edge
					? Math.round(next() * 100) / 100
					: next()
				: status === 'failed' && next() < 0.5
					? null
					: null
		return {
			id: `p${index}`,
			status,
			score,
			matchedByExportIds: VENDORS.filter(() => next() < 0.4),
			isSuggested: next() >= 0.3
		}
	})
}

for (const threshold of [0.5, 0.35, 0.62, 0.625]) {
	test(`binned counts equal pair-by-pair metrics at a cut-off of ${threshold}`, () => {
		const pairs = samplePairs(3_000, Math.round(threshold * 1000))
		const rows = binPairs({ pairs, vendorIds: VENDORS, threshold })
		VENDORS.forEach((vendor, index) => {
			const metricPairs = pairs.map((pair) => ({
				status: pair.status,
				score: pair.score,
				isVendorMatch: pair.matchedByExportIds.includes(vendor)
			}))
			assert.deepEqual(statsMetrics(rows, index), vendorMetrics(metricPairs, threshold))
			assert.deepEqual(statsSensitivity(rows, index), sensitivity(metricPairs))
			assert.deepEqual(statsHistogram(rows, index), histogram(metricPairs))
			assert.deepEqual(statsWorkload(rows, index), workload(metricPairs, threshold))
			// Every 0.01 draft the preview can show.
			for (let draft = 1; draft < 100; draft += 7) {
				assert.deepEqual(
					statsMetricsAt(rows, index, draft / 100),
					vendorMetrics(metricPairs, draft / 100)
				)
			}
		})
	})
}

test('head to head and coverage add up from the rows', () => {
	const threshold = 0.5
	const pairs = samplePairs(2_000, 7)
	const rows = binPairs({ pairs, vendorIds: VENDORS, threshold })
	const judged = pairs.filter((pair) => pair.status === 'succeeded' && pair.score != null)
	const disagreed = judged.filter(
		(pair) => pair.matchedByExportIds.includes('v1') !== pair.matchedByExportIds.includes('v2')
	)
	const sidedWithA = disagreed.filter(
		(pair) => pair.matchedByExportIds.includes('v1') === (pair.score ?? 0) >= threshold
	).length
	assert.deepEqual(statsHeadToHead(rows, 0, 1), {
		total: disagreed.length,
		sidedWithA,
		sidedWithB: disagreed.length - sidedWithA
	})
	const suggested = pairs.filter((pair) => pair.isSuggested).length
	assert.deepEqual(statsCoverage(rows), {
		total: pairs.length,
		suggested,
		addedByVendor: pairs.length - suggested
	})
})

test('a score lands in the bin a cut-off at that bin compares it with', () => {
	for (let k = 0; k <= 100; k++) {
		const edge = k / 100
		assert.equal(scoreBin(edge), k, `score ${edge}`)
		if (k > 0) assert.equal(scoreBin(edge - 1e-12), k - 1, `just below ${edge}`)
	}
	assert.equal(scoreBin(0.29), 29)
	assert.equal(scoreBin(1), 100)
})
