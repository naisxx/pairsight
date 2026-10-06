import { LIMITS } from '../limits'
import type { TabularAdapter } from './format'
import { FIRST_DATA_ROW, type TableError } from './table'

// Reads a file a batch of rows at a time, checking it as it goes: the header,
// the column and row limits and every row's width, with the row numbers a
// user sees. Nothing holds the whole file as a grid, so a file's size costs
// time, not memory (docs/PairSight-Scale-Roadmap.md, item 3).
//
// `onRows` gets each batch of trimmed data rows, within the row limit, the
// row number of its first row, and the (trimmed) header. The verdict only comes at the end (a row
// further down can be ragged), so a caller that writes rows checks the file
// with one scan first and writes on a second.

export type TableScan =
	| { ok: true; headers: string[]; rowCount: number; sheet?: string }
	| { ok: false; error: TableError }

// The error checks in the order a user should see them, as one table would
// be judged: something there, a usable header, within the limits, then
// every row the width of the header.
function verdict({
	headers,
	rowCount,
	maxRows,
	ragged
}: {
	headers: string[] | null
	rowCount: number
	maxRows: number
	ragged: number[]
}): TableError | null {
	if (headers == null || rowCount === 0) return { code: 'empty' }
	if (headers.length > LIMITS.maxColumns) {
		return { code: 'too_many_columns', limit: LIMITS.maxColumns, found: headers.length }
	}
	const blank = headers.flatMap((header, index) => (header === '' ? [index + 1] : []))
	if (blank.length > 0) return { code: 'blank_header', columns: blank }
	const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
	if (duplicates.length > 0) return { code: 'duplicate_header', headers: [...new Set(duplicates)] }
	if (rowCount > maxRows) return { code: 'too_many_rows', limit: maxRows, found: rowCount }
	if (ragged.length > 0) return { code: 'ragged_rows', rows: ragged }
	return null
}

class CallerError extends Error {
	constructor(cause: unknown) {
		super('onRows failed', { cause })
	}
}

export async function scanRows({
	adapter,
	bytes,
	maxRows,
	sheet,
	onRows
}: {
	adapter: TabularAdapter
	bytes: Uint8Array
	maxRows: number
	sheet?: string
	onRows?: (rows: string[][], firstRowNumber: number, headers: string[]) => void | Promise<void>
}): Promise<TableScan> {
	const opened = await adapter.open(bytes, { sheet })
	if (!opened.ok) return opened
	let headers: string[] | null = null
	let rowCount = 0
	const ragged: number[] = []
	try {
		for await (const batch of opened.rows) {
			const kept: string[][] = []
			let firstRowNumber = 0
			for (const row of batch) {
				if (headers == null) {
					headers = row.map((header) => header.trim())
					continue
				}
				rowCount++
				const rowNumber = rowCount + FIRST_DATA_ROW - 1
				if (row.length !== headers.length) ragged.push(rowNumber)
				if (rowCount > maxRows) continue
				if (kept.length === 0) firstRowNumber = rowNumber
				kept.push(row.map((cell) => cell.trim()))
			}
			if (kept.length > 0 && onRows != null && headers != null) {
				// The caller's own failure (a write) is its own, not the file's.
				await Promise.resolve(onRows(kept, firstRowNumber, headers)).catch((error: unknown) => {
					throw new CallerError(error)
				})
			}
		}
	} catch (error) {
		if (error instanceof CallerError) throw error.cause
		// A workbook that breaks part-way through (a corrupt or tampered zip).
		return { ok: false, error: { code: 'unreadable' } }
	}
	const error = verdict({ headers, rowCount, maxRows, ragged })
	if (error != null) return { ok: false, error }
	return {
		ok: true,
		headers: headers ?? [],
		rowCount,
		...(opened.sheet == null ? {} : { sheet: opened.sheet })
	}
}
