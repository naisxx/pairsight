import ExcelJS from 'exceljs'
import type { DecodeResult, TabularAdapter } from './format'
import type { Table } from './table'

export const SHEET_NAME = 'Findings'
const MIN_COLUMN_WIDTH = 8
const MAX_COLUMN_WIDTH = 50
const COLUMN_PADDING = 2
// A cell written as a number: a decimal with no leading zero, like a score
// (0.92). Whole numbers stay text, so a reference like 00123 or 123 is never
// reformatted.
const DECIMAL = /^-?(0|[1-9]\d*)\.(\d+)$/
// A number format that fixes the decimals shown ("0.00"), read back as shown.
const FIXED_DECIMALS = /^0\.(0+)$/

type CellValue = ExcelJS.CellValue
type Sheet = { name: string; grid: string[][]; dataRows: number }

function pad(value: number): string {
	return String(value).padStart(2, '0')
}

// Excel stores dates without a zone; ExcelJS hands them over as UTC.
function dateText(date: Date): string {
	const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
	const hasTime = date.getUTCHours() + date.getUTCMinutes() + date.getUTCSeconds() > 0
	return hasTime ? `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : day
}

// A cell as the text a person reads in Excel. Formulas give their last
// result; error cells (#N/A) and empty cells give ''.
function cellText(value: CellValue, numFmt: string | undefined): string {
	if (value == null) return ''
	if (value instanceof Date) return dateText(value)
	if (typeof value === 'number') {
		const decimals = numFmt == null ? null : FIXED_DECIMALS.exec(numFmt)?.[1]
		return decimals == null ? String(value) : value.toFixed(decimals.length)
	}
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
	if (typeof value === 'string') return value
	if ('richText' in value) return value.richText.map((part) => part.text).join('')
	if ('error' in value) return ''
	if ('result' in value) return cellText(value.result ?? null, numFmt)
	if ('text' in value)
		return typeof value.text === 'string' ? value.text : cellText(value.text, numFmt)
	return ''
}

function rowCells(row: ExcelJS.Row): string[] {
	const cells: string[] = []
	row.eachCell({ includeEmpty: false }, (cell, column) => {
		cells[column - 1] = cellText(cell.value, cell.numFmt)
	})
	const filled = Array.from(cells, (cell) => cell ?? '')
	while (filled.length > 0 && filled.at(-1)?.trim() === '') filled.pop()
	return filled
}

// The most a workbook may unpack to. An upload is at most 1 MB, but zipped
// XML can expand a thousandfold; a real 1 MB workbook unpacks to a few MB.
const MAX_UNPACKED_BYTES = 30_000_000
// Where the zip format keeps what declaredUnpackedBytes reads: the
// end-of-directory record, then one directory entry per file.
const ZIP = {
	endSignature: 0x06054b50,
	endMinSize: 22,
	endMaxComment: 0xffff,
	endEntryCount: 10,
	endDirectoryOffset: 16,
	entrySignature: 0x02014b50,
	entryHeaderSize: 46,
	entryUnpackedSize: 24,
	entryNameLength: 28,
	entryExtraLength: 30,
	entryCommentLength: 32
} as const

// The unpacked size the zip's directory declares, summed over its files, or
// null when there's no readable directory (not a zip). Checked before
// ExcelJS unpacks anything, so a zip bomb is refused rather than inflated.
function declaredUnpackedBytes(bytes: Uint8Array): number | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const lowest = Math.max(0, bytes.length - ZIP.endMinSize - ZIP.endMaxComment)
	let end = -1
	for (let at = bytes.length - ZIP.endMinSize; at >= lowest; at -= 1) {
		if (view.getUint32(at, true) === ZIP.endSignature) {
			end = at
			break
		}
	}
	if (end < 0) return null
	const entries = view.getUint16(end + ZIP.endEntryCount, true)
	let at = view.getUint32(end + ZIP.endDirectoryOffset, true)
	let total = 0
	for (let index = 0; index < entries; index += 1) {
		if (at + ZIP.entryHeaderSize > bytes.length) return null
		if (view.getUint32(at, true) !== ZIP.entrySignature) return null
		total += view.getUint32(at + ZIP.entryUnpackedSize, true)
		at +=
			ZIP.entryHeaderSize +
			view.getUint16(at + ZIP.entryNameLength, true) +
			view.getUint16(at + ZIP.entryExtraLength, true) +
			view.getUint16(at + ZIP.entryCommentLength, true)
	}
	return total
}

// Reads every visible sheet, in tab order, keeping at most the header and
// `keep` data rows of each but counting them all.
async function readSheets(bytes: Uint8Array, keep: number): Promise<Sheet[] | null> {
	const unpacked = declaredUnpackedBytes(bytes)
	if (unpacked == null || unpacked > MAX_UNPACKED_BYTES) return null
	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.load(new Uint8Array(bytes).buffer)
	return workbook.worksheets
		.filter((worksheet) => worksheet.state === 'visible')
		.map((worksheet) => {
			const sheet: Sheet = { name: worksheet.name, grid: [], dataRows: 0 }
			worksheet.eachRow({ includeEmpty: false }, (row) => {
				const cells = rowCells(row)
				if (cells.length === 0) return
				if (sheet.grid.length > 0) sheet.dataRows += 1
				if (sheet.dataRows <= keep) sheet.grid.push(cells)
			})
			return sheet
		})
}

// Excel leaves trailing empty cells out; every row is made as wide as the
// header so only a row with data past the header counts as ragged.
function padRows(grid: string[][]): string[][] {
	const width = grid[0]?.length ?? 0
	return grid.map((row) =>
		row.length >= width ? row : [...row, ...Array<string>(width - row.length).fill('')]
	)
}

function chooseSheet(sheets: Sheet[], wanted: string | undefined): DecodeResult {
	const withData = sheets.filter((sheet) => sheet.dataRows > 0)
	const chosen =
		withData.find((sheet) => sheet.name === wanted) ??
		(withData.length === 1 ? withData[0] : undefined)
	if (chosen != null) {
		return { ok: true, grid: padRows(chosen.grid), sheet: chosen.name, dataRows: chosen.dataRows }
	}
	if (withData.length === 0) return { ok: true, grid: [] }
	return {
		ok: false,
		error: {
			code: 'choose_sheet',
			sheets: withData.map((sheet) => ({ name: sheet.name, rows: sheet.dataRows }))
		}
	}
}

export function columnWidth(table: Table, index: number): number {
	const longest = Math.max(
		table.headers[index]?.length ?? 0,
		...table.rows.map((row) => row[index]?.length ?? 0)
	)
	return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + COLUMN_PADDING))
}

// Decimal cells (scores) written as numbers showing the same decimals.
export function applyDecimals(row: ExcelJS.Row, values: string[]) {
	values.forEach((value, index) => {
		const decimals = DECIMAL.exec(value)?.[2]
		if (decimals == null) return
		const cell = row.getCell(index + 1)
		cell.value = Number(value)
		cell.numFmt = `0.${'0'.repeat(decimals.length)}`
	})
}

// Excel workbooks (.xlsx). Reading unpacks the workbook and picks a sheet: the only
// one with data, the one asked for, or none (the user chooses). Writing gives
// one formatted sheet: a bold, frozen, filterable header row, sized columns,
// decimals as numbers. Every other cell is a text cell, never a formula.
export const xlsxAdapter: TabularAdapter = {
	format: 'xlsx',
	mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	extension: '.xlsx',
	async decode(bytes, { maxRows, sheet }) {
		// One past the limit, so the limit check still sees too many.
		const sheets = await readSheets(bytes, maxRows + 1).catch(() => null)
		if (sheets == null) return { ok: false, error: { code: 'unreadable' } }
		return chooseSheet(sheets, sheet)
	},
	async encode(table) {
		const workbook = new ExcelJS.Workbook()
		const worksheet = workbook.addWorksheet(SHEET_NAME, {
			views: [{ state: 'frozen', ySplit: 1 }]
		})
		worksheet.columns = table.headers.map((header, index) => ({
			header,
			width: columnWidth(table, index)
		}))
		worksheet.getRow(1).font = { bold: true }
		worksheet.autoFilter = {
			from: { row: 1, column: 1 },
			to: { row: 1, column: table.headers.length }
		}
		for (const values of table.rows) {
			applyDecimals(worksheet.addRow(values), values)
		}
		return new Uint8Array(await workbook.xlsx.writeBuffer())
	}
}
