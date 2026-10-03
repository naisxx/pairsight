import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITS } from './limits'
import { readTable } from './tabular'
import { buildComparisonSet, canonicalPair, expandGroup } from './pairs'
import { parseVendorPairs } from './vendors'

// Text through the tabular connector, as an uploaded .csv file would be read.
async function parseCsv(text: string, maxRows = LIMITS.maxSourceRecords) {
	return readTable({ fileName: 'test.csv', bytes: new TextEncoder().encode(text), maxRows })
}

test('pairs are canonical and self-pairs are excluded', () => {
	assert.deepEqual(canonicalPair('b', 'a'), { a: 'a', b: 'b' })
	assert.equal(canonicalPair('a', 'a'), null)
})

test('a group of n records expands to n(n-1)/2 pairs, deduping members', () => {
	assert.equal(expandGroup(['a', 'b', 'c', 'd']).length, 6)
	assert.deepEqual(expandGroup(['c', 'a', 'a', 'b']), [
		{ a: 'a', b: 'b' },
		{ a: 'a', b: 'c' },
		{ a: 'b', b: 'c' }
	])
	assert.equal(expandGroup(['solo']).length, 0)
})

test('the comparison set unions blocked and vendor pairs, once each', () => {
	const set = buildComparisonSet({
		blocked: [{ a: 'r1', b: 'r2', ruleIds: ['email'] }],
		vendorPairs: [
			{
				exportId: 'v1',
				pairs: [
					{ a: 'r1', b: 'r2' },
					{ a: 'r4', b: 'r5' }
				]
			},
			{ exportId: 'v2', pairs: [{ a: 'r1', b: 'r2' }] }
		]
	})
	assert.deepEqual(set, [
		{ a: 'r1', b: 'r2', ruleIds: ['email'], matchedByExportIds: ['v1', 'v2'] },
		// Outside every blocking rule, but a vendor matched it: always included.
		{ a: 'r4', b: 'r5', ruleIds: [], matchedByExportIds: ['v1'] }
	])
})

test('vendor pairs: unknown references are errors; self, repeated and reversed rows collapse', async () => {
	const parsed = await parseCsv('left,right,score\nA,B,0.9\nB,A,0.8\nA,A,1\nA,Z,0.5\nC,,0.1')
	assert.ok(parsed.ok)
	const result = parseVendorPairs({
		table: parsed.table,
		columnA: 'left',
		columnB: 'right',
		recordIdByReference: new Map([
			['A', 'id-a'],
			['B', 'id-b'],
			['C', 'id-c']
		])
	})
	assert.deepEqual(result.pairs, [{ a: 'id-a', b: 'id-b' }])
	assert.deepEqual(result.duplicateRows, [3])
	assert.deepEqual(result.selfPairRows, [4])
	assert.deepEqual(result.unknownReferences, [{ row: 5, reference: 'Z' }])
	assert.deepEqual(result.missingReferenceRows, [6])
	assert.equal(result.isValid, false)
})
