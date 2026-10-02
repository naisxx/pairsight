import type { TabularFormat } from '@/lib/pairsight/tabular-formats'
import type { Table, TableError } from './table'

// A file's cells as rows of text, before the shared checks; `sheet` names the
// sheet a workbook was read from. A format that stops keeping rows past the
// limit says how many data rows there really were (`dataRows`), so the limit
// message gives the true count.
export type DecodeResult =
	| { ok: true; grid: string[][]; sheet?: string; dataRows?: number }
	| { ok: false; error: TableError }

// One file format: turns a file's bytes into a grid of cells and a table back
// into bytes. Nothing else: limits and checks are shared (validateTable), so
// every format behaves the same once read. `maxRows` lets a format stop
// keeping rows it will never use; `sheet` picks a workbook's sheet.
export type TabularAdapter = {
	format: TabularFormat
	mimeType: string
	extension: string
	decode: (bytes: Uint8Array, options: { maxRows: number; sheet?: string }) => Promise<DecodeResult>
	encode: (table: Table) => Promise<Uint8Array>
}
