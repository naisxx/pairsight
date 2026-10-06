import Papa from 'papaparse'
import type { TabularAdapter } from './format'

const BOM = '﻿'
// A cell starting with one of these is a formula to a spreadsheet; written
// out, it gets a leading ' so opening the file never runs it.
const FORMULA_START = /^[=+\-@\t\r]/

function guardFormula(cell: string): string {
	return FORMULA_START.test(cell) ? `'${cell}` : cell
}

// What a written file starts with: a byte-order mark, so Excel reads UTF-8
// names correctly.
export const CSV_START = BOM
const CRLF = '\r\n'

// Rows as CSV lines, each ended with CRLF, any cell that looks like a formula
// guarded: one call or many give the same text, so a file can be written a
// page at a time (stream.ts).
export function csvLines(rows: string[][]): string {
	if (rows.length === 0) return ''
	const text = Papa.unparse(
		rows.map((row) => row.map(guardFormula)),
		{ newline: CRLF }
	)
	return `${text}${CRLF}`
}

// CSV, UTF-8. Reading drops a byte-order mark and blank lines; writing adds
// the mark and uses CRLF line endings.
export const csvAdapter: TabularAdapter = {
	format: 'csv',
	mimeType: 'text/csv; charset=utf-8',
	extension: '.csv',
	async decode(bytes) {
		const text = new TextDecoder('utf-8').decode(bytes).replace(new RegExp(`^${BOM}`), '')
		return { ok: true, grid: Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' }).data }
	},
	async encode(table) {
		return new TextEncoder().encode(`${CSV_START}${csvLines([table.headers, ...table.rows])}`)
	}
}
