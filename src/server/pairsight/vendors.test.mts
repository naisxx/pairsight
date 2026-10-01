import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from './csv'
import { detectVendorColumns, parseVendorFile } from './vendors'

function table(text: string) {
	const parsed = parseCsv(text)
	assert.ok(parsed.ok)
	return parsed.table
}

const references = new Set(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
const ids = new Map([...references].map((reference) => [reference, `id-${reference}`]))

// Shaped like a real group export: one row per record, PairId groups them, and
// other columns repeat too (a constant label, a score per pair, a state).
const groupFile = [
	'PairId,RecordType,Record,Score,State,Account Code',
	'1,Matched,1,99,MA,C1',
	'1,Matched,2,99,MA,C2',
	'2,Matched,3,96,TX,C3',
	'2,Matched,4,96,TX,C4',
	'3,Matched,5,94,OR,C5',
	'3,Matched,6,94,OR,C6'
].join('\n')

test('a group file is recognised by its reference column and the column named for groups', () => {
	assert.deepEqual(detectVendorColumns({ table: table(groupFile), references }), {
		columns: { format: 'group', groupColumn: 'PairId', referenceColumn: 'Account Code' }
	})
})

test('a pair file is recognised by its two reference columns, in file order', () => {
	const pairFile = 'score,second,first\n0.9,C2,C1\n0.8,C4,C3\n'
	assert.deepEqual(detectVendorColumns({ table: table(pairFile), references }), {
		columns: { format: 'pair', columnA: 'second', columnB: 'first' }
	})
})

test('a pair file whose second column is all wrong still reads as pairs, by its column names', () => {
	assert.deepEqual(
		detectVendorColumns({ table: table('left_id,right_id\nC1,R99\n'), references }),
		{
			columns: { format: 'pair', columnA: 'left_id', columnB: 'right_id' }
		}
	)
})

test('a file without the source references says so; two group-like columns ask', () => {
	assert.deepEqual(detectVendorColumns({ table: table('a,b\nx,y\nz,w\n'), references }), {
		columns: null,
		reason: 'no_reference_column',
		guess: null
	})
	const twoGroupings = 'g1,g2,ref\nA,X,C1\nA,X,C2\nB,Y,C3\nB,Y,C4\n'
	const detection = detectVendorColumns({ table: table(twoGroupings), references })
	assert.equal(detection.columns, null)
	assert.ok(detection.columns == null && detection.reason === 'ambiguous_group')
})

test('groups expand to every pair inside them, once each, with duplicates counted', () => {
	const text = 'group,ref\nG1,C1\nG1,C2\nG1,C3\nG1,C3\nG2,C1\nG2,C2\nG3,C4\n'
	const result = parseVendorFile({
		table: table(text),
		columns: { format: 'group', groupColumn: 'group', referenceColumn: 'ref' },
		recordIdByReference: ids,
		maxPairs: 100
	})
	assert.ok(result.isValid)
	// G1 → C1-C2, C1-C3, C2-C3; G2 repeats C1-C2; G3 is a single record.
	assert.equal(result.pairs.length, 3)
	assert.deepEqual(result.stats, { rows: 7, pairs: 3, groups: 3, duplicates: 2, selfPairs: 0 })
})

test('groups block on unknown or missing references and on expanding past the cap', () => {
	const text = 'group,ref\nG1,C1\nG1,C99\nG1,\nG2,C2\nG2,C3\nG2,C4\n'
	const result = parseVendorFile({
		table: table(text),
		columns: { format: 'group', groupColumn: 'group', referenceColumn: 'ref' },
		recordIdByReference: ids,
		maxPairs: 2
	})
	assert.equal(result.isValid, false)
	assert.deepEqual(result.unknownReferences, [{ row: 3, reference: 'C99' }])
	assert.deepEqual(result.missingReferenceRows, [4])
	// G2's three records make three pairs: over a cap of two.
	assert.equal(result.tooManyPairs, true)
})
