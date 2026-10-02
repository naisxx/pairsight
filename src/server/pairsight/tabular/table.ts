import { LIMITS } from '../limits'

// A file's contents as a plain table, whatever format it came in. Pure: takes
// the decoded grid and returns the table or an issue, never throws on bad
// input. Row numbers are the spreadsheet line numbers a user sees (header = 1,
// first data row = 2).

export type Table = { headers: string[]; rows: string[][] }

export type TableError =
	| { code: 'empty' }
	| { code: 'unsupported_format' }
	// A corrupt, password-protected or otherwise unreadable file.
	| { code: 'unreadable' }
	// A workbook with more than one sheet holding data: the user picks one.
	// Not a problem with the file, so the screens show a choice, not an error.
	| { code: 'choose_sheet'; sheets: Array<{ name: string; rows: number }> }
	| { code: 'too_many_rows'; limit: number; found: number }
	| { code: 'too_many_columns'; limit: number; found: number }
	| { code: 'blank_header'; columns: number[] }
	| { code: 'duplicate_header'; headers: string[] }
	| { code: 'ragged_rows'; rows: number[] }

// `sheet`: which sheet of a workbook was read (formats with sheets only).
export type TableResult =
	{ ok: true; table: Table; sheet?: string } | { ok: false; error: TableError }

export const FIRST_DATA_ROW = 2

// The checks every format shares, in order: something there, a usable header
// row, within the limits, and every row as wide as the header. Cells and
// headers are trimmed. `dataRows`: the file's true row count, when the grid was
// cut short at the limit.
export function validateTable(
	grid: string[][],
	{ maxRows, dataRows }: { maxRows: number; dataRows?: number }
): TableResult {
	const [headerRow, ...rows] = grid
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
	const found = dataRows ?? rows.length
	if (found > maxRows) {
		return { ok: false, error: { code: 'too_many_rows', limit: maxRows, found } }
	}
	const ragged = rows.flatMap((row, index) =>
		row.length === headers.length ? [] : [index + FIRST_DATA_ROW]
	)
	if (ragged.length > 0) return { ok: false, error: { code: 'ragged_rows', rows: ragged } }

	return { ok: true, table: { headers, rows: rows.map((row) => row.map((cell) => cell.trim())) } }
}
