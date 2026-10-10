import Papa from 'papaparse'
import type { LegacyEncoding, TabularAdapter } from './format'

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

// Rows read in a batch before they're handed on.
const READ_BATCH = 2_000
// What Excel's plain "CSV" and older Windows tools write. Every byte is a
// character in it, so it can't fail, and it reads Latin-1 files right too.
const WINDOWS_ENCODING: LegacyEncoding = 'windows-1252'

// A CSV's text: UTF-8 when the bytes are valid UTF-8 (anything saved as
// "CSV UTF-8", and plain ASCII), else Windows Western European, rather than
// turning "Zoë" into "Zo�".
export function decodeCsv(bytes: Uint8Array): { text: string; encoding?: LegacyEncoding } {
	try {
		const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
		return { text: text.replace(new RegExp(`^${BOM}`), '') }
	} catch {
		return { text: new TextDecoder(WINDOWS_ENCODING).decode(bytes), encoding: WINDOWS_ENCODING }
	}
}

// A CSV's rows, a batch at a time: Papa parses the text row by row and
// pauses after each batch, so the parsed file is never held whole.
async function* csvRows(text: string): AsyncGenerator<string[][]> {
	let batch: string[][] = []
	let paused: Papa.Parser | null = null
	let isDone = false
	const step = (result: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
		batch.push(result.data)
		if (batch.length >= READ_BATCH) {
			paused = parser
			parser.pause()
		}
	}
	// Runs until the first pause; each resume runs to the next one.
	Papa.parse<string[]>(text, {
		skipEmptyLines: 'greedy',
		step,
		complete: () => {
			isDone = true
		}
	})
	for (;;) {
		if (batch.length > 0) {
			const ready = batch
			batch = []
			yield ready
		}
		if (isDone || paused == null) return
		const parser: Papa.Parser = paused
		paused = null
		parser.resume()
	}
}

// CSV, UTF-8 (or Windows Western European, read only). Reading drops a
// byte-order mark and blank lines; writing adds the mark and uses CRLF line
// endings.
export const csvAdapter: TabularAdapter = {
	format: 'csv',
	mimeType: 'text/csv; charset=utf-8',
	extension: '.csv',
	async open(bytes) {
		const { text, encoding } = decodeCsv(bytes)
		return { ok: true, rows: csvRows(text), ...(encoding == null ? {} : { encoding }) }
	},
	async encode(table) {
		return new TextEncoder().encode(`${CSV_START}${csvLines([table.headers, ...table.rows])}`)
	}
}
