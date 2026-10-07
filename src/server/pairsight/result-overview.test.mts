import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOverview, fieldPatterns, summarizePairs, type SummaryPair } from './result-overview'
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
		isSuggested: true,
		isLowConfidence: false,
		...overrides
	}
}

const judged = (score: number) => ({ status: 'succeeded' as const, score })

function pair(
	id: string,
	isSuggested: boolean,
	matchedBy: string[],
	assessment: SummaryPair['assessment']
): SummaryPair {
	return {
		id,
		recordAId: `${id}-a`,
		recordBId: `${id}-b`,
		isSuggested,
		matchedByExportIds: matchedBy,
		assessment
	}
}

function summary(pairs: SummaryPair[]) {
	return summarizePairs({
		pairs,
		records: new Map(),
		vendorIds: ['v1', 'v2'],
		threshold: 0.5,
		columnRoles: {},
		country: 'US'
	})
}

const vendors = [
	{ id: 'v1', name: 'One' },
	{ id: 'v2', name: 'Two' }
]
const noTop = { missed: [], merges: [] }

test('sources: suggested pairs first, then the ones only a vendor added', () => {
	const overview = buildOverview({
		summary: summary([
			pair('p1', true, ['v1'], judged(0.9)),
			pair('p2', true, [], judged(0.9)),
			pair('p3', false, ['v1'], judged(0.1))
		]),
		vendors,
		vendorId: 'v1',
		top: noTop
	})
	assert.deepEqual(
		overview.sources.map((source) => [source.suggested, source.total]),
		[
			[true, 2],
			[false, 1]
		]
	)
	assert.equal(overview.sources[0]?.counts.pairsight_only, 1)
	assert.equal(overview.sources[1]?.counts.vendor_only, 1)
	// A source with no pairs isn't listed.
	const suggestedOnly = buildOverview({
		summary: summary([pair('p1', true, [], judged(0.9))]),
		vendors,
		vendorId: 'v1',
		top: noTop
	})
	assert.deepEqual(
		suggestedOnly.sources.map((source) => source.suggested),
		[true]
	)
})

test('top disagreements: surest missed duplicates, least sure merges', () => {
	const { top } = summary([
		pair('a', true, [], judged(0.7)),
		pair('b', true, [], judged(0.95)),
		pair('c', true, ['v1'], judged(0.4)),
		pair('d', true, ['v1'], judged(0.1))
	])
	assert.deepEqual(top.v1, { missed: ['b', 'a'], merges: ['d', 'c'] })
	// v2 matched none of them: every Jev "same" is a miss.
	assert.deepEqual(top.v2, { missed: ['b', 'a'], merges: [] })
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

test('the overview counts every pair: groups, coverage and the other vendor', () => {
	const overview = buildOverview({
		summary: summary([
			pair('p1', true, ['v1', 'v2'], judged(0.9)),
			pair('p2', true, ['v2'], judged(0.2)),
			pair('p3', false, ['v1'], { status: 'failed', score: null }),
			pair('p4', true, [], { status: 'pending', score: null })
		]),
		vendors,
		vendorId: 'v1',
		top: noTop
	})
	assert.deepEqual(overview.metrics.counts, {
		both_matched: 1,
		pairsight_only: 0,
		vendor_only: 0,
		neither_matched: 1,
		incomplete: 2
	})
	assert.equal(overview.byVendor[1]?.metrics.counts.vendor_only, 1)
	assert.deepEqual(overview.coverage, {
		total: 4,
		assessed: 2,
		pending: 1,
		failed: 1,
		suggested: 3,
		addedByVendor: 1,
		notCompared: 0
	})
	assert.deepEqual(
		overview.overlap?.groups.map((group) => [group.key, group.total]),
		[
			['both', 1],
			['firstOnly', 0],
			['secondOnly', 1],
			['neither', 0]
		]
	)
})
