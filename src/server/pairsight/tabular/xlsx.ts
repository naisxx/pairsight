import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import type { OpenResult, TabularAdapter } from './format'
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
// Rows read in a batch before they're handed on.
const READ_BATCH = 2_000

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

// The most a workbook may unpack to. Zipped XML can expand a thousandfold;
// a real workbook at the upload limit unpacks to a few hundred MB at most,
// and is read as a stream, so this only refuses a zip bomb.
const MAX_UNPACKED_BYTES = 500_000_000
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
	entryCommentLength: 32,
	entryLocalOffset: 42,
	endDirectorySize: 12,
	// A value this large means the real one is in a ZIP64 record.
	zip64Marker: 0xffffffff
} as const

// The parts of a workbook the streaming reader needs before any sheet: the
// sheet names, where they live, number formats (dates) and shared text.
const METADATA_FIRST = [
	'xl/workbook.xml',
	'xl/_rels/workbook.xml.rels',
	'xl/styles.xml',
	'xl/sharedStrings.xml'
]

// The end-of-directory record's offset, or -1 when there's none (not a zip).
function endOfDirectory(view: DataView, length: number): number {
	const lowest = Math.max(0, length - ZIP.endMinSize - ZIP.endMaxComment)
	for (let at = length - ZIP.endMinSize; at >= lowest; at -= 1) {
		if (view.getUint32(at, true) === ZIP.endSignature) return at
	}
	return -1
}

type DirectoryEntry = { name: string; localOffset: number; start: number; end: number }

// The zip's directory: each file's name, where its data starts, and where
// its directory record sits. Null when it can't be read.
function directoryOf(bytes: Uint8Array): { entries: DirectoryEntry[]; end: number } | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const end = endOfDirectory(view, bytes.length)
	if (end < 0) return null
	const count = view.getUint16(end + ZIP.endEntryCount, true)
	let at = view.getUint32(end + ZIP.endDirectoryOffset, true)
	if (at === ZIP.zip64Marker) return null
	const decoder = new TextDecoder()
	const entries: DirectoryEntry[] = []
	for (let index = 0; index < count; index += 1) {
		if (at + ZIP.entryHeaderSize > bytes.length) return null
		if (view.getUint32(at, true) !== ZIP.entrySignature) return null
		const nameLength = view.getUint16(at + ZIP.entryNameLength, true)
		const next =
			at +
			ZIP.entryHeaderSize +
			nameLength +
			view.getUint16(at + ZIP.entryExtraLength, true) +
			view.getUint16(at + ZIP.entryCommentLength, true)
		const localOffset = view.getUint32(at + ZIP.entryLocalOffset, true)
		if (localOffset === ZIP.zip64Marker) return null
		const name = decoder.decode(
			bytes.subarray(at + ZIP.entryHeaderSize, at + ZIP.entryHeaderSize + nameLength)
		)
		entries.push({ name, localOffset, start: at, end: next })
		at = next
	}
	return { entries, end }
}

// The same zip with the workbook's metadata first. ExcelJS's streaming
// reader reads a zip front to back and needs the sheet list, number formats
// and shared text before a sheet; ExcelJS itself, and other tools, write
// them after. The compressed files are copied as they are, only reordered,
// with the directory's offsets rewritten: nothing is unpacked.
export function metadataFirst(bytes: Uint8Array): Uint8Array | null {
	const directory = directoryOf(bytes)
	if (directory == null) return null
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const directoryStart = view.getUint32(directory.end + ZIP.endDirectoryOffset, true)
	// Each file's data runs from its offset to the next file's (or the directory).
	const byOffset = [...directory.entries].sort((a, b) => a.localOffset - b.localOffset)
	const extent = new Map(
		byOffset.map((entry, index) => [
			entry,
			{ from: entry.localOffset, to: byOffset[index + 1]?.localOffset ?? directoryStart }
		])
	)
	const rank = (entry: DirectoryEntry) => {
		const index = METADATA_FIRST.indexOf(entry.name)
		return index === -1 ? METADATA_FIRST.length : index
	}
	const ordered = [...byOffset].sort((a, b) => rank(a) - rank(b) || a.localOffset - b.localOffset)
	const records = ordered.map((entry) => {
		const { from, to } = extent.get(entry) ?? { from: 0, to: 0 }
		return { entry, data: bytes.subarray(from, to) }
	})
	const dataSize = records.reduce((sum, record) => sum + record.data.length, 0)
	const directorySize = ordered.reduce((sum, entry) => sum + (entry.end - entry.start), 0)
	const tail = bytes.subarray(directory.end)
	const out = new Uint8Array(dataSize + directorySize + tail.length)
	const outView = new DataView(out.buffer)
	let at = 0
	const offsets = new Map<DirectoryEntry, number>()
	for (const { entry, data } of records) {
		offsets.set(entry, at)
		out.set(data, at)
		at += data.length
	}
	const newDirectoryStart = at
	for (const entry of ordered) {
		out.set(bytes.subarray(entry.start, entry.end), at)
		outView.setUint32(at + ZIP.entryLocalOffset, offsets.get(entry) ?? 0, true)
		at += entry.end - entry.start
	}
	out.set(tail, at)
	outView.setUint32(at + ZIP.endDirectoryOffset, newDirectoryStart, true)
	outView.setUint32(at + ZIP.endDirectorySize, directorySize, true)
	return out
}

// The unpacked size the zip's directory declares, summed over its files, or
// null when there's no readable directory (not a zip). Checked before
// ExcelJS unpacks anything, so a zip bomb is refused rather than inflated.
function declaredUnpackedBytes(bytes: Uint8Array): number | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const end = endOfDirectory(view, bytes.length)
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

// A sheet's name and whether it's shown, which the streaming reader carries
// at run time but doesn't declare.
function sheetOf(worksheet: object): { name: string; isVisible: boolean } {
	const name: unknown = Reflect.get(worksheet, 'name')
	const state: unknown = Reflect.get(worksheet, 'state')
	return {
		name: typeof name === 'string' ? name : '',
		isVisible: state == null || state === 'visible'
	}
}

function streamOf(bytes: Uint8Array) {
	return new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([Buffer.from(bytes)]), {
		sharedStrings: 'cache',
		styles: 'cache',
		hyperlinks: 'ignore',
		worksheets: 'emit',
		entries: 'ignore'
	})
}

// Every visible sheet with the rows it holds below its header, read as a
// stream: the first of two passes, to pick the sheet.
async function sheetSizes(bytes: Uint8Array): Promise<Array<{ name: string; rows: number }>> {
	const sizes: Array<{ name: string; rows: number }> = []
	for await (const worksheet of streamOf(bytes)) {
		const { name, isVisible } = sheetOf(worksheet)
		let rows = 0
		for await (const row of worksheet) {
			if (isVisible && rowCells(row).length > 0) rows++
		}
		if (isVisible) sizes.push({ name, rows: Math.max(0, rows - 1) })
	}
	return sizes
}

// One sheet's non-empty rows, a batch at a time. Excel leaves trailing empty
// cells out, so every row is made as wide as the header: only a row with
// data past the header counts as ragged.
async function* sheetRows(bytes: Uint8Array, name: string): AsyncGenerator<string[][]> {
	let width: number | null = null
	let batch: string[][] = []
	for await (const worksheet of streamOf(bytes)) {
		const isWanted = sheetOf(worksheet).name === name
		for await (const row of worksheet) {
			if (!isWanted) continue
			const cells = rowCells(row)
			if (cells.length === 0) continue
			width ??= cells.length
			batch.push(
				cells.length >= width ? cells : [...cells, ...Array<string>(width - cells.length).fill('')]
			)
			if (batch.length >= READ_BATCH) {
				yield batch
				batch = []
			}
		}
	}
	if (batch.length > 0) yield batch
}

async function* noRows(): AsyncGenerator<string[][]> {}

// Picks the sheet to read: the one asked for, or the only one with data;
// otherwise the user chooses.
async function openWorkbook(bytes: Uint8Array, wanted: string | undefined): Promise<OpenResult> {
	const unpacked = declaredUnpackedBytes(bytes)
	const ordered = unpacked == null || unpacked > MAX_UNPACKED_BYTES ? null : metadataFirst(bytes)
	if (ordered == null) return { ok: false, error: { code: 'unreadable' } }
	const sizes = await sheetSizes(ordered).catch(() => null)
	if (sizes == null) return { ok: false, error: { code: 'unreadable' } }
	const withData = sizes.filter((sheet) => sheet.rows > 0)
	const chosen =
		withData.find((sheet) => sheet.name === wanted) ??
		(withData.length === 1 ? withData[0] : undefined)
	if (chosen != null) return { ok: true, rows: sheetRows(ordered, chosen.name), sheet: chosen.name }
	if (withData.length === 0) return { ok: true, rows: noRows() }
	return { ok: false, error: { code: 'choose_sheet', sheets: withData } }
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

// Excel workbooks (.xlsx). Reading streams the workbook and picks a sheet:
// the only one with data, the one asked for, or none (the user chooses). Writing gives
// one formatted sheet: a bold, frozen, filterable header row, sized columns,
// decimals as numbers. Every other cell is a text cell, never a formula.
export const xlsxAdapter: TabularAdapter = {
	format: 'xlsx',
	mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	extension: '.xlsx',
	open(bytes, { sheet }) {
		return openWorkbook(bytes, sheet)
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
