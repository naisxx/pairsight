import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { RuleStats } from './blocking'
import { LIMITS } from './limits'
import { pairKey, type ComparisonPair } from './pairs'
import { summarizePlan } from './plan-summary'

function stat(ruleId: string, pairCount: number, largestBucket = 2): RuleStats {
	return {
		ruleId,
		bucketCount: 1,
		pairCount,
		largestBucket,
		recordsWithoutKey: 0,
		oversizedBuckets: []
	}
}

function pair(a: string, b: string, ruleIds: string[], matchedByExportIds: string[] = []) {
	return { a, b, ruleIds, matchedByExportIds } satisfies ComparisonPair
}

const rules = [
	{ id: 'email', fields: ['email' as const] },
	{ id: 'phone', fields: ['phone' as const] }
]

test('counts: overlapping rules and vendor pairs are counted once, reuse is subtracted', () => {
	const comparison = [
		pair('r1', 'r2', ['email', 'phone'], ['v1']),
		pair('r2', 'r3', ['phone']),
		pair('r4', 'r5', [], ['v1'])
	]
	const { counts, blockers } = summarizePlan({
		recordCount: 5,
		rules,
		ruleStats: [stat('email', 1), stat('phone', 2)],
		blockedPairCount: 2,
		comparison,
		vendorPairs: [
			{ a: 'r1', b: 'r2' },
			{ a: 'r4', b: 'r5' },
			{ a: 'r1', b: 'r2' }
		],
		reusableKeys: new Set([pairKey({ a: 'r1', b: 'r2' })]),
		vendorCount: 1,
		jevFieldCount: 3
	})
	assert.deepEqual(counts, {
		records: 5,
		blockedPairs: 2,
		vendorPairs: 2,
		addedByVendorOnly: 1,
		uniquePairs: 3,
		allPossiblePairs: 10,
		reusable: 1,
		toEvaluate: 2
	})
	assert.deepEqual(blockers, [])
})

test('blockers: each missing piece is reported, not just the first', () => {
	const { blockers } = summarizePlan({
		recordCount: 3,
		rules: [],
		ruleStats: [],
		blockedPairCount: 0,
		comparison: [],
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 0,
		jevFieldCount: 0
	})
	assert.deepEqual(blockers, ['no_vendors', 'no_jev_fields', 'no_pairs'])
})

test('over the cap: blocked, with the biggest source of pairs named first', () => {
	const over = LIMITS.maxPairsPerRun + 1
	const comparison = Array.from({ length: over }, (_, index) =>
		pair(`a${index}`, `b${index}`, index < 3 ? [] : ['phone'])
	)
	const { blockers, contributors } = summarizePlan({
		recordCount: 200,
		rules,
		ruleStats: [stat('email', 0), stat('phone', over - 3, 120)],
		blockedPairCount: over - 3,
		comparison,
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 1
	})
	assert.deepEqual(blockers, ['too_many_pairs'])
	// A rule with no pairs isn't a cause, so it isn't listed.
	assert.deepEqual(contributors, [
		{
			kind: 'rule',
			ruleId: 'phone',
			fields: ['phone'],
			pairCount: over - 3,
			largestBucket: 120
		},
		{ kind: 'vendors', pairCount: 3 }
	])
})

test('exactly at the cap is allowed', () => {
	const comparison = Array.from({ length: LIMITS.maxPairsPerRun }, (_, index) =>
		pair(`a${index}`, `b${index}`, ['email'])
	)
	const { blockers } = summarizePlan({
		recordCount: 500,
		rules,
		ruleStats: [stat('email', LIMITS.maxPairsPerRun)],
		blockedPairCount: LIMITS.maxPairsPerRun,
		comparison,
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 1
	})
	assert.deepEqual(blockers, [])
})
