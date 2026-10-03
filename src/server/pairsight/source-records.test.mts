import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkColumns, validateSourceRecords } from './source-records'
import { readTable } from './tabular'
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

test('validateSourceRecords reports missing and duplicate references with row numbers', async () => {
	const parsed = await parseCsv('ref,name\nA,Ann\n,Bo\nA,Cy\nB,Di')
	assert.ok(parsed.ok)
	const result = validateSourceRecords({ table: parsed.table, referenceColumn: 'ref' })
	assert.equal(result.isValid, false)
	assert.deepEqual(result.issues.missing, [3])
	assert.deepEqual(result.issues.duplicates, [{ reference: 'A', rows: [2, 4] }])
	assert.deepEqual(result.records[3], {
		reference: 'B',
		rowNumber: 5,
		values: { ref: 'B', name: 'Di' }
	})
})

test('checkColumns rates every column as a reference, capping the lists but not the counts', async () => {
	const parsed = await parseCsv('ref,name\nR1,Ann\nR1,\n,Bo\nR2,Bo\nR3,Bo\n')
	assert.ok(parsed.ok)
	const checks = checkColumns(parsed.table, 1)
	assert.deepEqual(checks.ref, {
		blank: 1,
		missing: [4],
		duplicates: [{ reference: 'R1', rows: [2, 3] }],
		duplicateCount: 1
	})
	assert.equal(checks.name?.blank, 1)
	assert.deepEqual(checks.name?.missing, [3])
	assert.deepEqual(checks.name?.duplicates, [{ reference: 'Bo', rows: [4, 5, 6] }])
	assert.equal(checks.name?.duplicateCount, 1)
})
