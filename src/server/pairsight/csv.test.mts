import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, validateSourceRecords } from './csv'
import { suggestReferenceColumn, suggestRole } from './fields'
import { LIMITS } from './limits'

test('parseCsv strips a BOM, keeps quoted commas and newlines, trims cells', () => {
	const result = parseCsv('﻿id,name\n1,"Smith, Jane"\n2,"Line one\nline two"\n3,  Ann  \n')
	assert.ok(result.ok)
	assert.deepEqual(result.table.headers, ['id', 'name'])
	assert.deepEqual(result.table.rows, [
		['1', 'Smith, Jane'],
		['2', 'Line one\nline two'],
		['3', 'Ann']
	])
})

test('parseCsv rejects empty files, blank or duplicate headers and ragged rows', () => {
	assert.deepEqual(parseCsv(''), { ok: false, error: { code: 'empty' } })
	assert.deepEqual(parseCsv('id\n'), { ok: false, error: { code: 'empty' } })
	assert.deepEqual(parseCsv('id,,name\n1,2,3'), {
		ok: false,
		error: { code: 'blank_header', columns: [2] }
	})
	assert.deepEqual(parseCsv('id,id\n1,2'), {
		ok: false,
		error: { code: 'duplicate_header', headers: ['id'] }
	})
	assert.deepEqual(parseCsv('id,name\n1,Ann\n2\n3,Bo'), {
		ok: false,
		error: { code: 'ragged_rows', rows: [3] }
	})
})

test('parseCsv enforces the row limit', () => {
	const rows = Array.from({ length: LIMITS.maxSourceRecords + 1 }, (_, i) => `${i},x`).join('\n')
	const result = parseCsv(`id,name\n${rows}`)
	assert.equal(result.ok, false)
	assert.equal(!result.ok && result.error.code, 'too_many_rows')
})

test('validateSourceRecords reports missing and duplicate references with row numbers', () => {
	const parsed = parseCsv('ref,name\nA,Ann\n,Bo\nA,Cy\nB,Di')
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

test('field suggestions come from header names', () => {
	assert.equal(suggestRole('Email Address'), 'email')
	assert.equal(suggestRole('Mobile'), 'phone')
	assert.equal(suggestRole('DOB'), 'date_of_birth')
	assert.equal(suggestRole('Surname'), 'last_name')
	assert.equal(suggestRole('first_name'), 'first_name')
	assert.equal(suggestRole('ZIP'), 'postcode')
	assert.equal(suggestRole('loyalty_tier'), 'other')
	assert.equal(suggestReferenceColumn(['name', 'record_id']), 'record_id')
})
