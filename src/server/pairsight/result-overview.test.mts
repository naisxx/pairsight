import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fieldPatterns, hardCases, sourceBreakdown, topDisagreements } from './result-overview'
import type { ResultRow } from './result-rows'

function row(id: string, overrides: Partial<ResultRow>): ResultRow {
	return {
		id,
		category: 'both_matched',
		recordA: { id: `${id}-a`, reference: `${id}A`, label: id },
		recordB: { id: `${id}-b`, reference: `${id}B`, label: id },
		isVendorMatch: true,
		status: 'succeeded',
		score: 0.9,
		errorCode: null,
		ruleIds: ['email'],
		isFuzzyOnly: false,
		isLowConfidence: false,
		...overrides
	}
}

test('sources count a pair under each rule, with vendor-only additions last', () => {
	const sources = sourceBreakdown([
		row('p1', { ruleIds: ['email', 'phone'] }),
		row('p2', { ruleIds: ['email'], category: 'pairsight_only' }),
		row('p3', { ruleIds: [], category: 'vendor_only' })
	])
	assert.deepEqual(
		sources.map((source) => [source.ruleId, source.total]),
		[
			['email', 2],
			['phone', 1],
			[null, 1]
		]
	)
	assert.equal(sources[0]?.counts.pairsight_only, 1)
})

test('top disagreements: surest missed duplicates, least sure merges', () => {
	const top = topDisagreements([
		row('a', { category: 'pairsight_only', score: 0.7 }),
		row('b', { category: 'pairsight_only', score: 0.95 }),
		row('c', { category: 'vendor_only', score: 0.4 }),
		row('d', { category: 'vendor_only', score: 0.1 })
	])
	assert.deepEqual(
		top.missed.map((r) => r.id),
		['b', 'a']
	)
	assert.deepEqual(
		top.merges.map((r) => r.id),
		['d', 'c']
	)
})

test('field patterns compare normalized values and skip missing ones', () => {
	const values = (email: string, name: string) => ({ values: { email, name } })
	const records = new Map([
		['p1-a', values('ana@x.com', 'Ana')],
		['p1-b', values('ANA@x.com', 'Anna')],
		['p2-a', values('bo@x.com', '')],
		['p2-b', values('bo@x.com', 'Bo')]
	])
	const patterns = fieldPatterns({
		rows: [row('p1', { category: 'pairsight_only' }), row('p2', { category: 'pairsight_only' })],
		records,
		columnRoles: { email: 'email', name: 'full_name' },
		country: 'US'
	})
	assert.deepEqual(patterns.columns, [{ category: 'pairsight_only', count: 2 }])
	const cell = (role: string) =>
		patterns.rows.find((patternRow) => patternRow.role === role)?.cells.pairsight_only
	assert.deepEqual(cell('email'), { same: 2, total: 2, share: 1 })
	assert.deepEqual(cell('full_name'), { same: 0, total: 1, share: 0 })
	assert.deepEqual(patterns.summary.pairsight_only, { shared: ['email'], different: ['full_name'] })
})

test('hard cases: duplicates only fuzzy rules found, and who caught them', () => {
	const judged = (score: number) => ({ status: 'succeeded' as const, score })
	const result = hardCases({
		pairs: [
			// Only the fuzzy rule found it; Jev says duplicate; A caught it.
			{ ruleIds: ['surname_sound_birth_year'], matchedByExportIds: ['a'], assessment: judged(0.9) },
			// Fuzzy and exact both found it: not a hard case.
			{
				ruleIds: ['email', 'surname_sound_birth_year'],
				matchedByExportIds: [],
				assessment: judged(0.9)
			},
			// Fuzzy-only, but Jev says different people.
			{ ruleIds: ['surname_sound_birth_year'], matchedByExportIds: ['b'], assessment: judged(0.1) },
			// Fuzzy-only and confirmed; nobody caught it.
			{ ruleIds: ['surname_sound_birth_year'], matchedByExportIds: [], assessment: judged(0.7) },
			// Added by a vendor alone: no rule, not a hard case.
			{ ruleIds: [], matchedByExportIds: ['b'], assessment: judged(0.9) }
		],
		fuzzyRuleIds: new Set(['surname_sound_birth_year']),
		vendors: [{ id: 'a' }, { id: 'b' }],
		threshold: 0.5
	})
	assert.deepEqual(result, {
		found: 3,
		confirmed: 2,
		byVendor: [
			{ id: 'a', caught: 1 },
			{ id: 'b', caught: 0 }
		]
	})
})
