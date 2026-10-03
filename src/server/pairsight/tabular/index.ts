import { tabularFormatOf, type TabularFormat } from '@/lib/pairsight/tabular-formats'
import { csvAdapter } from './csv'
import type { TabularAdapter } from './format'
import { validateTable, type Table, type TableResult } from './table'
import { xlsxAdapter } from './xlsx'

// The tabular connector: every file PairSight reads (records, vendor exports)
// and writes (findings) goes through here. Formats differ only in their
// adapter; reading always ends in the same checks (validateTable).

export type { Table, TableError, TableResult } from './table'
export { FIRST_DATA_ROW } from './table'

const ADAPTERS: Record<TabularFormat, TabularAdapter> = { csv: csvAdapter, xlsx: xlsxAdapter }

export function adapterFor(format: TabularFormat): TabularAdapter {
	return ADAPTERS[format]
}

// A file's bytes as a table, by its name's extension. `sheet` picks a
// workbook's sheet when it has several (see TableError 'choose_sheet').
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
	const format = tabularFormatOf(fileName)
	if (format == null) return { ok: false, error: { code: 'unsupported_format' } }
	const decoded = await adapterFor(format).decode(bytes, { maxRows, sheet })
	if (!decoded.ok) return decoded
	const result = validateTable(decoded.grid, { maxRows, dataRows: decoded.dataRows })
	return result.ok && decoded.sheet != null ? { ...result, sheet: decoded.sheet } : result
}

export function writeTable(table: Table, format: TabularFormat): Promise<Uint8Array> {
	return adapterFor(format).encode(table)
}
