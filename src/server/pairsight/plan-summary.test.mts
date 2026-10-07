import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITS } from './limits'
import { pairKey, type ComparisonPair } from './pairs'
import { summarizePlan } from './plan-summary'

function pair(a: string, b: string, isSuggested: boolean, matchedByExportIds: string[] = []) {
	return { a, b, isSuggested, matchedByExportIds } satisfies ComparisonPair
}

const ready = { state: 'done' as const, reason: null }

function plan(overrides: Partial<Parameters<typeof summarizePlan>[0]> = {}) {
	return summarizePlan({
		recordCount: 5,
		comparison: [pair('r1', 'r2', true)],
		vendorPairs: [{ a: 'r1', b: 'r2' }],
		reusableKeys: new Set(),
		vendorCount: 1,
		jevFieldCount: 3,
		suggestions: ready,
		...overrides
	})
}

test('counts: suggested and vendor pairs are counted once, reuse is subtracted', () => {
	const { counts, blockers, contributors } = plan({
		comparison: [
			pair('r1', 'r2', true, ['v1']),
			pair('r2', 'r3', true),
			pair('r4', 'r5', false, ['v1'])
		],
		vendorPairs: [
			{ a: 'r1', b: 'r2' },
			{ a: 'r4', b: 'r5' },
			{ a: 'r1', b: 'r2' }
		],
		reusableKeys: new Set([pairKey({ a: 'r1', b: 'r2' })])
	})
	assert.deepEqual(counts, {
		records: 5,
		suggestedPairs: 2,
		vendorPairs: 2,
		addedByVendorOnly: 1,
		uniquePairs: 3,
		allPossiblePairs: 10,
		reusable: 1,
		toEvaluate: 2
	})
	assert.deepEqual(blockers, [])
	assert.deepEqual(contributors, [
		{ kind: 'suggested', pairCount: 2 },
		{ kind: 'vendors', pairCount: 1 }
	])
})

test('blockers: each missing piece is reported, not just the first', () => {
	const { blockers } = plan({ comparison: [], vendorPairs: [], vendorCount: 0, jevFieldCount: 0 })
	assert.deepEqual(blockers, ['no_vendors', 'no_jev_fields', 'no_pairs'])
})

test('one field for Jev is not enough to run', () => {
	assert.deepEqual(plan({ jevFieldCount: 1 }).blockers, ['no_jev_fields'])
	assert.deepEqual(plan({ jevFieldCount: 2 }).blockers, [])
})

test('the run waits for suggestions, and says when they failed or the file is too small', () => {
	assert.deepEqual(plan({ suggestions: { state: 'waiting', reason: null } }).blockers, [
		'still_suggesting'
	])
	assert.deepEqual(plan({ suggestions: { state: 'failed', reason: null } }).blockers, [
		'suggestions_failed'
	])
	assert.deepEqual(plan({ suggestions: { state: 'skipped', reason: 'not_set_up' } }).blockers, [
		'suggestions_failed'
	])
	assert.deepEqual(
		plan({ suggestions: { state: 'skipped', reason: 'too_few_records' } }).blockers,
		['too_few_records']
	)
	// Nothing to check yet isn't "no pairs" while suggestions are still coming.
	assert.deepEqual(
		plan({ comparison: [], suggestions: { state: 'waiting', reason: null } }).blockers,
		['still_suggesting']
	)
})

test('a plan over the limit is blocked, and says which source is biggest', () => {
	const many = Array.from({ length: LIMITS.maxPairsPerRun + 1 }, (_, index) =>
		pair(`a${index}`, `b${index}`, index % 3 !== 0)
	)
	const { blockers, contributors } = plan({ comparison: many })
	assert.deepEqual(blockers, ['too_many_pairs'])
	assert.equal(contributors[0]?.kind, 'suggested')
})
