import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	histogram,
	possiblePairs,
	sensitivity,
	stableRange,
	vendorMetrics,
	vendorOverlap,
	workload,
	type MetricPair
} from './metrics'

const judged = (score: number, isVendorMatch: boolean): MetricPair => ({
	status: 'succeeded',
	score,
	isVendorMatch
})

// At 0.5: two both-matched, one vendor-only (0.3), one PairSight-only (0.9),
// two neither, one pending and one failed.
const pairs: MetricPair[] = [
	judged(0.95, true),
	judged(0.7, true),
	judged(0.3, true),
	judged(0.9, false),
	judged(0.1, false),
	judged(0.45, false),
	{ status: 'pending', score: null, isVendorMatch: true },
	{ status: 'failed', score: null, isVendorMatch: false }
]

test('precision, recall and F1 use the vendor as the claim and Jev as the reference', () => {
	const metrics = vendorMetrics(pairs, 0.5)
	assert.deepEqual(metrics.counts, {
		both_matched: 2,
		pairsight_only: 1,
		vendor_only: 1,
		neither_matched: 2,
		incomplete: 2
	})
	assert.equal(metrics.assessed, 6)
	assert.equal(metrics.pending, 1)
	assert.equal(metrics.failed, 1)
	assert.equal(metrics.precision, 2 / 3)
	assert.equal(metrics.recall, 2 / 3)
	assert.ok(Math.abs((metrics.f1 ?? 0) - 2 / 3) < 1e-9)
})

test('a metric with nothing to divide by is null, never zero', () => {
	const metrics = vendorMetrics([judged(0.1, false)], 0.5)
	assert.equal(metrics.precision, null)
	assert.equal(metrics.recall, null)
	assert.equal(metrics.f1, null)
})

test('the sweep covers 0.05–0.95, and the stable range brackets the current threshold', () => {
	const points = sensitivity(pairs)
	assert.equal(points.length, 19)
	assert.equal(points[0]?.threshold, 0.05)
	assert.equal(points.at(-1)?.threshold, 0.95)
	const current = vendorMetrics(pairs, 0.5)
	// Nothing scores between 0.45 and 0.7, so 0.5–0.7 all read the same.
	assert.deepEqual(stableRange(points, current), { from: 0.5, to: 0.7 })
})

test('the histogram splits judged scores by the vendor decision', () => {
	const bins = histogram(pairs)
	assert.equal(bins.length, 10)
	assert.deepEqual(bins[9], { from: 0.9, to: 1, matched: 1, notMatched: 1 })
	assert.equal(
		bins.reduce((sum, bin) => sum + bin.matched + bin.notMatched, 0),
		6
	)
})

test('vendor overlap groups judged pairs by which vendors matched them', () => {
	const groups = vendorOverlap(
		[
			{ status: 'succeeded', score: 0.9, matchedBy: ['a', 'b'] },
			{ status: 'succeeded', score: 0.2, matchedBy: ['b'] },
			{ status: 'succeeded', score: 0.8, matchedBy: [] },
			{ status: 'pending', score: null, matchedBy: ['a'] }
		],
		['a', 'b'],
		0.5
	)
	assert.deepEqual(groups, [
		{ key: 'both', total: 1, sameIndividual: 1 },
		{ key: 'firstOnly', total: 0, sameIndividual: 0 },
		{ key: 'secondOnly', total: 1, sameIndividual: 0 },
		{ key: 'neither', total: 1, sameIndividual: 1 }
	])
})

test('the workload counts disagreements, borderline scores and incomplete pairs', () => {
	assert.deepEqual(workload(pairs, 0.5), {
		disagreements: 2,
		pairsightOnly: 1,
		vendorOnly: 1,
		nearThreshold: 1,
		incomplete: 2
	})
	assert.equal(possiblePairs(20), 190)
})
