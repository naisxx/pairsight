// A file's contents as a plain table, whatever format it came in, and the
// problems reading one can find (scan.ts checks them). Row numbers are the
// spreadsheet line numbers a user sees (header = 1, first data row = 2).

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
	// A records file too small for PairSight to learn which pairs to check.
	| { code: 'too_few_rows'; minimum: number; found: number }
	| { code: 'too_many_columns'; limit: number; found: number }
	| { code: 'blank_header'; columns: number[] }
	| { code: 'duplicate_header'; headers: string[] }
	| { code: 'ragged_rows'; rows: number[] }

// `sheet`: which sheet of a workbook was read (formats with sheets only).
export type TableResult =
	{ ok: true; table: Table; sheet?: string } | { ok: false; error: TableError }

export const FIRST_DATA_ROW = 2
