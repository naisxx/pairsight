import Papa from 'papaparse'
import type { TabularAdapter } from './format'

const BOM = '﻿'
// A cell starting with one of these is a formula to a spreadsheet; written
// out, it gets a leading ' so opening the file never runs it.
const FORMULA_START = /^[=+\-@\t\r]/

function guardFormula(cell: string): string {
	return FORMULA_START.test(cell) ? `'${cell}` : cell
}

// CSV, UTF-8. Reading drops a byte-order mark and blank lines; writing adds
// the mark (so Excel reads UTF-8 names correctly) and uses CRLF line endings.
export const csvAdapter: TabularAdapter = {
	format: 'csv',
	mimeType: 'text/csv; charset=utf-8',
	extension: '.csv',
	async decode(bytes) {
		const text = new TextDecoder('utf-8').decode(bytes).replace(new RegExp(`^${BOM}`), '')
		return { ok: true, grid: Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' }).data }
	},
	async encode(table) {
		const text = Papa.unparse(
			{
				fields: table.headers.map(guardFormula),
				data: table.rows.map((row) => row.map(guardFormula))
			},
			{ newline: '\r\n' }
		)
		return new TextEncoder().encode(`${BOM}${text}\r\n`)
	}
}
