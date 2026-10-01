import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	applyFilters,
	buildRows,
	byReference,
	countCategories,
	parseResultFilters,
	pickVendorId,
	type PairInput
} from './result-rows'

const records = new Map(
	['R2', 'R10', 'R3', 'R4'].map((reference) => [
		`id-${reference}`,
		{ id: `id-${reference}`, reference, label: `Person ${reference}` }
	])
)

function pair(id: string, a: string, b: string, overrides: Partial<PairInput> = {}): PairInput {
	return {
		id,
		recordAId: `id-${a}`,
		recordBId: `id-${b}`,
		ruleIds: ['email'],
		matchedByExportIds: [],
		assessment: { status: 'succeeded', score: 0.9, errorCode: null },
		...overrides
	}
}

const pairs: PairInput[] = [
	pair('p1', 'R10', 'R2', { matchedByExportIds: ['v1'] }),
	pair('p2', 'R3', 'R4', { assessment: { status: 'succeeded', score: 0.55, errorCode: null } }),
	pair('p3', 'R2', 'R3', {
		ruleIds: [],
		matchedByExportIds: ['v1'],
		assessment: { status: 'succeeded', score: 0.1, errorCode: null }
	}),
	pair('p4', 'R4', 'R10', { assessment: { status: 'failed', score: null, errorCode: 'http_422' } })
]

const rows = buildRows({ pairs, records, threshold: 0.5, vendorId: 'v1' })

test('rows are categorized per vendor, failed pairs are incomplete, records read in reference order', () => {
	assert.deepEqual(
		rows.map((row) => [row.id, row.category]),
		[
			['p1', 'both_matched'],
			['p2', 'pairsight_only'],
			['p3', 'vendor_only'],
			['p4', 'incomplete']
		]
	)
	assert.deepEqual([rows[0]?.recordA.reference, rows[0]?.recordB.reference], ['R2', 'R10'])
	assert.equal(rows[1]?.isLowConfidence, true)
	assert.deepEqual(countCategories(rows), {
		pairsight_only: 1,
		vendor_only: 1,
		both_matched: 1,
		neither_matched: 0,
		incomplete: 1
	})
})

test('the list puts disagreements first and filters by category, source, confidence and search', () => {
	assert.deepEqual(
		applyFilters(rows, {}).map((row) => row.id),
		['p2', 'p3', 'p1', 'p4']
	)
	assert.deepEqual(
		applyFilters(rows, { source: 'vendor' }).map((row) => row.id),
		['p3']
	)
	assert.deepEqual(
		applyFilters(rows, { lowConfidence: '1' }).map((row) => row.id),
		['p2']
	)
	assert.deepEqual(
		applyFilters(rows, { category: 'incomplete' }).map((row) => row.id),
		['p4']
	)
	assert.deepEqual(
		applyFilters(rows, { q: 'person r3' }).map((row) => row.id),
		['p2', 'p3']
	)
})

test('the status filter splits judged pairs from incomplete ones', () => {
	assert.deepEqual(
		applyFilters(rows, { status: 'evaluated' }).map((row) => row.id),
		['p2', 'p3', 'p1']
	)
	assert.deepEqual(
		applyFilters(rows, { status: 'incomplete' }).map((row) => row.id),
		['p4']
	)
})

// Ignored filters come back as undefined keys; drop them to compare.
const defined = (filters: object) =>
	Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined))

test('invalid URL filters are ignored, and an unknown vendor falls back to the first', () => {
	assert.deepEqual(defined(parseResultFilters({ category: 'nonsense' })), {})
	assert.deepEqual(defined(parseResultFilters({ category: 'vendor_only', page: '2' })), {
		category: 'vendor_only',
		page: 2
	})
	// A GET form submits an "All" select as an empty value; the other filters survive it.
	assert.deepEqual(defined(parseResultFilters({ q: 'jane', source: '', status: '' })), {
		q: 'jane'
	})
	assert.equal(pickVendorId([{ id: 'v1' }, { id: 'v2' }], 'v2'), 'v2')
	assert.equal(pickVendorId([{ id: 'v1' }, { id: 'v2' }], 'missing'), 'v1')
	assert.deepEqual(byReference({ reference: 'R10' }, { reference: 'R9' }), [
		{ reference: 'R9' },
		{ reference: 'R10' }
	])
})

test('disagreements, score sides, ranges and the band filter on PairSight decisions', () => {
	assert.deepEqual(
		applyFilters(rows, { category: 'disagreements' }).map((row) => row.id),
		['p2', 'p3']
	)
	assert.deepEqual(
		applyFilters(rows, { score: 'above' }).map((row) => row.id),
		['p2', 'p1']
	)
	assert.deepEqual(
		applyFilters(rows, { score: 'below' }).map((row) => row.id),
		['p3']
	)
	assert.deepEqual(
		applyFilters(rows, { score: 'near' }).map((row) => row.id),
		['p2']
	)
	assert.deepEqual(
		applyFilters(rows, { score: 'r:0.9-1.0' }).map((row) => row.id),
		['p1']
	)
	// An unparseable score filter is ignored, like any other bad URL param.
	assert.equal(defined(parseResultFilters({ score: 'r:2-3' })).score, undefined)
})

test('sorting by score keeps unscored pairs last in either direction', () => {
	assert.deepEqual(
		applyFilters(rows, { sort: 'score-asc' }).map((row) => row.id),
		['p3', 'p2', 'p1', 'p4']
	)
	assert.deepEqual(
		applyFilters(rows, { sort: 'score-desc' }).map((row) => row.id),
		['p1', 'p2', 'p3', 'p4']
	)
})
