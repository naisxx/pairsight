import type { TabularFormat } from '@/lib/pairsight/tabular-formats'
import type { Table, TableError } from './table'

// A file opened for reading: its raw rows a batch at a time, before the
// shared checks (scan.ts), and which sheet of a workbook they come from.
export type OpenResult =
	{ ok: true; rows: AsyncIterable<string[][]>; sheet?: string } | { ok: false; error: TableError }

// One file format: opens a file's bytes as rows and writes a table back into
// bytes. Nothing else: limits and checks are shared (scan.ts), so every
// format behaves the same once read. `sheet` picks a workbook's sheet.
export type TabularAdapter = {
	format: TabularFormat
	mimeType: string
	extension: string
	open: (bytes: Uint8Array, options: { sheet?: string }) => Promise<OpenResult>
	encode: (table: Table) => Promise<Uint8Array>
}
