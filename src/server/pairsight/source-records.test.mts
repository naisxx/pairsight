import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkColumns, columnChecker, isUsableReference, toSourceRecord } from './source-records'
import { readTable, scanTable } from './tabular'
import { LIMITS } from './limits'

// Text through the tabular connector, as an uploaded .csv file would be read.
async function parseCsv(text: string, maxRows = LIMITS.maxSourceRecords) {
	return readTable({ fileName: 'test.csv', bytes: new TextEncoder().encode(text), maxRows })
}

test('the CSV reader strips a BOM, keeps quoted commas and newlines, trims cells', async () => {
	const result = await parseCsv('﻿id,name\n1,"Smith, Jane"\n2,"Line one\nline two"\n3,  Ann  \n')
	assert.ok(result.ok)
	assert.deepEqual(result.table.headers, ['id', 'name'])
	assert.deepEqual(result.table.rows, [
		['1', 'Smith, Jane'],
		['2', 'Line one\nline two'],
		['3', 'Ann']
	])
})

test('the CSV reader rejects empty files, blank or duplicate headers and ragged rows', async () => {
	assert.deepEqual(await parseCsv(''), { ok: false, error: { code: 'empty' } })
	assert.deepEqual(await parseCsv('id\n'), { ok: false, error: { code: 'empty' } })
	assert.deepEqual(await parseCsv('id,,name\n1,2,3'), {
		ok: false,
		error: { code: 'blank_header', columns: [2] }
	})
	assert.deepEqual(await parseCsv('id,id\n1,2'), {
		ok: false,
		error: { code: 'duplicate_header', headers: ['id'] }
	})
	assert.deepEqual(await parseCsv('id,name\n1,Ann\n2\n3,Bo'), {
		ok: false,
		error: { code: 'ragged_rows', rows: [3] }
	})
})

test('the CSV reader enforces the row limit', async () => {
	const rows = Array.from({ length: LIMITS.maxSourceRecords + 1 }, (_, i) => `${i},x`).join('\n')
	const result = await parseCsv(`id,name\n${rows}`)
	assert.equal(result.ok, false)
	assert.equal(!result.ok && result.error.code, 'too_many_rows')
})

test('the ID column check reports blank and repeated IDs with row numbers', async () => {
	const parsed = await parseCsv('ref,name\nA,Ann\n,Bo\nA,Cy\nB,Di')
	assert.ok(parsed.ok)
	const check = checkColumns(parsed.table, 20).ref
	assert.equal(isUsableReference(check), false)
	assert.deepEqual(check?.missing, [3])
	assert.deepEqual(check?.duplicates, [{ reference: 'A', rows: [2, 4], count: 2 }])
	assert.deepEqual(
		toSourceRecord({
			headers: parsed.table.headers,
			row: ['B', 'Di'],
			rowNumber: 5,
			referenceIndex: 0
		}),
		{ reference: 'B', rowNumber: 5, values: { ref: 'B', name: 'Di' } }
	)
})

test('rows checked a batch at a time give the same checks as the whole file', async () => {
	const rows = Array.from(
		{ length: 5_000 },
		(_, index) => `R${index % 4_000},${index % 7 === 0 ? '' : 'x'}`
	)
	const text = `ref,note\n${rows.join('\n')}`
	const parsed = await parseCsv(text)
	assert.ok(parsed.ok)
	const checker = columnChecker(['ref', 'note'], 20)
	const batches: number[] = []
	const scan = await scanTable({
		fileName: 'big.csv',
		bytes: new TextEncoder().encode(text),
		maxRows: LIMITS.maxSourceRecords,
		onRows: (batch, firstRowNumber) => {
			batches.push(firstRowNumber)
			checker.add(batch, firstRowNumber)
		}
	})
	assert.deepEqual(scan, { ok: true, headers: ['ref', 'note'], rowCount: 5_000 })
	// Read in more than one batch, numbered from the first data row on.
	assert.ok(batches.length > 1)
	assert.equal(batches[0], 2)
	assert.deepEqual(checker.result(), checkColumns(parsed.table, 20))
	assert.equal(checker.result().ref?.duplicateCount, 1_000)
})

test('a file over the row limit still says how many rows it has', async () => {
	const rows = Array.from({ length: 30 }, (_, index) => `R${index}`).join('\n')
	const seen: number[] = []
	const scan = await scanTable({
		fileName: 'long.csv',
		bytes: new TextEncoder().encode(`ref\n${rows}`),
		maxRows: 10,
		onRows: (batch) => {
			seen.push(batch.length)
		}
	})
	assert.deepEqual(scan, { ok: false, error: { code: 'too_many_rows', limit: 10, found: 30 } })
	// Rows past the limit are counted, never handed on.
	assert.equal(
		seen.reduce((sum, count) => sum + count, 0),
		10
	)
})

test('checkColumns rates every column as a reference, capping the lists but not the counts', async () => {
	const parsed = await parseCsv('ref,name\nR1,Ann\nR1,\n,Bo\nR2,Bo\nR3,Bo\n')
	assert.ok(parsed.ok)
	const checks = checkColumns(parsed.table, 1)
	assert.deepEqual(checks.ref, {
		blank: 1,
		missing: [4],
		duplicates: [{ reference: 'R1', rows: [2], count: 2 }],
		duplicateCount: 1
	})
	assert.equal(checks.name?.blank, 1)
	assert.deepEqual(checks.name?.missing, [3])
	assert.deepEqual(checks.name?.duplicates, [{ reference: 'Bo', rows: [4], count: 3 }])
	assert.equal(checks.name?.duplicateCount, 1)
})
