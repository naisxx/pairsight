import { tabularFormatOf, type TabularFormat } from '@/lib/pairsight/tabular-formats'
import { csvAdapter } from './csv'
import type { TabularAdapter } from './format'
import { scanRows, type TableScan } from './scan'
import type { Table, TableResult } from './table'
import { xlsxAdapter } from './xlsx'

// The tabular connector: every file PairSight reads (records, vendor exports)
// and writes (findings) goes through here. Formats differ only in their
// adapter; reading always goes through the same checks (scan.ts).

export type { Table, TableError, TableResult } from './table'
export { FIRST_DATA_ROW } from './table'
export type { TableScan } from './scan'
export type { LegacyEncoding } from './format'

const ADAPTERS: Record<TabularFormat, TabularAdapter> = { csv: csvAdapter, xlsx: xlsxAdapter }

export function adapterFor(format: TabularFormat): TabularAdapter {
	return ADAPTERS[format]
}

// A file's rows a batch at a time, checked as they go (scan.ts), by its
// name's extension. `sheet` picks a workbook's sheet when it has several
// (see TableError 'choose_sheet').
export async function scanTable({
	fileName,
	bytes,
	maxRows,
	sheet,
	onRows
}: {
	fileName: string
	bytes: Uint8Array
	maxRows: number
	sheet?: string
	onRows?: (rows: string[][], firstRowNumber: number, headers: string[]) => void | Promise<void>
}): Promise<TableScan> {
	const format = tabularFormatOf(fileName)
	if (format == null) return { ok: false, error: { code: 'unsupported_format' } }
	return scanRows({ adapter: adapterFor(format), bytes, maxRows, sheet, onRows })
}

// A whole (small) file as a table: a vendor's pairs, a test's fixture.
export async function readTable({
	fileName,
	bytes,
	maxRows,
	sheet
}: {
	fileName: string
	bytes: Uint8Array
	maxRows: number
	sheet?: string
}): Promise<TableResult> {
	const rows: string[][] = []
	const scan = await scanTable({
		fileName,
		bytes,
		maxRows,
		sheet,
		onRows: (batch) => {
			for (const row of batch) rows.push(row)
		}
	})
	if (!scan.ok) return scan
	const table = { headers: scan.headers, rows }
	return scan.sheet == null ? { ok: true, table } : { ok: true, table, sheet: scan.sheet }
}

export function writeTable(table: Table, format: TabularFormat): Promise<Uint8Array> {
	return adapterFor(format).encode(table)
}
