import Papa from 'papaparse'
import { LIMITS } from './limits'

// CSV parsing and source-record validation. Pure: takes the file's text and
// returns data or issues, never throws on bad input. Row numbers are the
// spreadsheet line numbers a user sees (header = 1, first data row = 2).

export type CsvTable = { headers: string[]; rows: string[][] }

export type CsvParseError =
	| { code: 'empty' }
	| { code: 'too_many_rows'; limit: number; found: number }
	| { code: 'too_many_columns'; limit: number; found: number }
	| { code: 'blank_header'; columns: number[] }
	| { code: 'duplicate_header'; headers: string[] }
	| { code: 'ragged_rows'; rows: number[] }

export type CsvParseResult = { ok: true; table: CsvTable } | { ok: false; error: CsvParseError }

const FIRST_DATA_ROW = 2

export function parseCsv(text: string, maxRows: number = LIMITS.maxSourceRecords): CsvParseResult {
	const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
	const [headerRow, ...rows] = parsed.data
	if (headerRow == null || rows.length === 0) return { ok: false, error: { code: 'empty' } }

	const headers = headerRow.map((header) => header.trim())
	if (headers.length > LIMITS.maxColumns) {
		return {
			ok: false,
			error: { code: 'too_many_columns', limit: LIMITS.maxColumns, found: headers.length }
		}
	}
	const blank = headers.flatMap((header, index) => (header === '' ? [index + 1] : []))
	if (blank.length > 0) return { ok: false, error: { code: 'blank_header', columns: blank } }
	const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
	if (duplicates.length > 0) {
		return { ok: false, error: { code: 'duplicate_header', headers: [...new Set(duplicates)] } }
	}
	if (rows.length > maxRows) {
		return { ok: false, error: { code: 'too_many_rows', limit: maxRows, found: rows.length } }
	}
	const ragged = rows.flatMap((row, index) =>
		row.length === headers.length ? [] : [index + FIRST_DATA_ROW]
	)
	if (ragged.length > 0) return { ok: false, error: { code: 'ragged_rows', rows: ragged } }

	return { ok: true, table: { headers, rows: rows.map((row) => row.map((cell) => cell.trim())) } }
}

export type SourceRecordInput = {
	reference: string
	rowNumber: number
	values: Record<string, string>
}

export type ReferenceIssues = {
	missing: number[]
	duplicates: Array<{ reference: string; rows: number[] }>
}

export type SourceValidation = {
	records: SourceRecordInput[]
	issues: ReferenceIssues
	isValid: boolean
}

export function validateSourceRecords({
	table,
	referenceColumn
}: {
	table: CsvTable
	referenceColumn: string
}): SourceValidation {
	const referenceIndex = table.headers.indexOf(referenceColumn)
	const rowsByReference = new Map<string, number[]>()
	const missing: number[] = []
	const records = table.rows.map((row, index) => {
		const rowNumber = index + FIRST_DATA_ROW
		const reference = referenceIndex === -1 ? '' : (row[referenceIndex] ?? '')
		if (reference === '') missing.push(rowNumber)
		else rowsByReference.set(reference, [...(rowsByReference.get(reference) ?? []), rowNumber])
		return {
			reference,
			rowNumber,
			values: Object.fromEntries(table.headers.map((header, column) => [header, row[column] ?? '']))
		}
	})
	const duplicates = [...rowsByReference.entries()]
		.filter(([, rows]) => rows.length > 1)
		.map(([reference, rows]) => ({ reference, rows }))
	return {
		records,
		issues: { missing, duplicates },
		isValid: referenceIndex !== -1 && missing.length === 0 && duplicates.length === 0
	}
}
