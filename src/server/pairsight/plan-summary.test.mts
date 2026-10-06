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
		oversized: null
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
		toEvaluate: 2,
		splinkPairs: 0,
		addedBySplinkOnly: 0,
		isExact: true
	})
	assert.deepEqual(blockers, [])
})

test('blockers: each missing piece is reported, not just the first', () => {
	const { blockers } = summarizePlan({
		recordCount: 3,
		rules: [],
		ruleStats: [],
		comparison: [],
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 0,
		jevFieldCount: 0
	})
	assert.deepEqual(blockers, ['no_vendors', 'no_jev_fields', 'no_pairs'])
})

test('one field for Jev is not enough to run', () => {
	const { blockers } = summarizePlan({
		recordCount: 3,
		rules: [],
		ruleStats: [],
		comparison: [pair('a', 'b', [])],
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 1
	})
	assert.deepEqual(blockers, ['no_jev_fields'])
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
		comparison,
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 2
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
		comparison,
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 2
	})
	assert.deepEqual(blockers, [])
})

test('rules too big to build: blocked as far over, counts are a floor, the rule is named', () => {
	const huge = 12_497_500
	const comparison = [pair('v1', 'v2', [], ['vendor'])]
	const { counts, blockers, contributors } = summarizePlan({
		recordCount: 5_000,
		rules,
		ruleStats: [stat('email', huge, 5_000), stat('phone', 10)],
		isComplete: false,
		comparison,
		vendorPairs: [{ a: 'v1', b: 'v2' }],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 2
	})
	assert.deepEqual(blockers, ['too_many_pairs'])
	assert.equal(counts.isExact, false)
	assert.equal(counts.uniquePairs, huge)
	assert.equal(counts.reusable, 0)
	assert.equal(contributors[0]?.kind === 'rule' && contributors[0].ruleId, 'email')
})

test('rules too big to build, none over on its own: still over the limit', () => {
	const { counts, blockers } = summarizePlan({
		recordCount: 5_000,
		rules,
		ruleStats: [stat('email', 60_000), stat('phone', 60_000)],
		isComplete: false,
		comparison: [],
		vendorPairs: [],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 2
	})
	assert.deepEqual(blockers, ['too_many_pairs'])
	assert.equal(counts.uniquePairs, LIMITS.maxPairsPerRun + 1)
})

test('Splink’s picks: counted once with the rules, its own additions and its share named', () => {
	const comparison = [
		pair('r1', 'r2', ['email', 'splink']),
		pair('r3', 'r4', ['splink']),
		pair('r5', 'r6', ['splink'], ['v1']),
		pair('r7', 'r8', ['phone'])
	]
	const { counts, contributors } = summarizePlan({
		recordCount: 10,
		rules,
		ruleStats: [stat('email', 1), stat('phone', 1)],
		splinkPairCount: 3,
		comparison,
		vendorPairs: [{ a: 'r5', b: 'r6' }],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 2
	})
	assert.equal(counts.uniquePairs, 4)
	// Picked by a rule or by Splink: all four.
	assert.equal(counts.blockedPairs, 4)
	assert.equal(counts.splinkPairs, 3)
	assert.equal(counts.addedBySplinkOnly, 2)
	assert.equal(counts.addedByVendorOnly, 0)
	assert.deepEqual(contributors[0], { kind: 'splink', pairCount: 3 })
})
