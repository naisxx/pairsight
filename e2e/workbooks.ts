import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { expect, type Page } from '@playwright/test'

// Excel files for the specs, built from the CSV fixtures so the two formats
// always hold the same records, and read back from what the app exports.

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const WHOLE_NUMBER = /^[1-9]\d*$/

// A cell as Excel would hold it once typed in: dates as dates, whole numbers
// as numbers, everything else as text.
function excelValue(cell: string): ExcelJS.CellValue {
	const date = ISO_DATE.exec(cell)
	if (date != null) return new Date(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3])))
	return WHOLE_NUMBER.test(cell) ? Number(cell) : cell
}

// A workbook whose `sheet` holds the CSV's rows. `before`: sheets placed ahead
// of it, as a real export's notes or summary tab would be.
export async function workbookFromCsv(
	csv: string,
	{ sheet, before = {} }: { sheet: string; before?: Record<string, string[][]> }
): Promise<Buffer> {
	const book = new ExcelJS.Workbook()
	for (const [name, rows] of Object.entries(before)) book.addWorksheet(name).addRows(rows)
	const rows = Papa.parse<string[]>(csv.trim()).data
	const worksheet = book.addWorksheet(sheet)
	worksheet.addRows(rows.map((row, index) => (index === 0 ? row : row.map(excelValue))))
	const dateColumn = rows[0]?.indexOf('date_of_birth') ?? -1
	if (dateColumn >= 0) worksheet.getColumn(dateColumn + 1).numFmt = 'yyyy-mm-dd'
	return Buffer.from(await book.xlsx.writeBuffer())
}

export function fixtureWorkbook(path: string, sheet: string): Promise<Buffer> {
	return workbookFromCsv(readFileSync(path, 'utf8'), { sheet })
}

// The findings, downloaded from the Export menu in the chosen format.
export async function exportFindings(page: Page, runNumber: number, item: RegExp) {
	await page.getByRole('button', { name: `Download run ${runNumber}’s results` }).click()
	const downloading = page.waitForEvent('download')
	await page.getByRole('menuitem', { name: item }).click()
	return downloading
}

// An exported workbook's first sheet: its name, header (and whether it's
// bold and frozen), and every row as text.
export async function readWorkbook(path: string) {
	const book = new ExcelJS.Workbook()
	await book.xlsx.load(new Uint8Array(readFileSync(path)).buffer)
	const worksheet = book.worksheets[0]
	expect(worksheet).toBeDefined()
	const rows: string[][] = []
	worksheet?.eachRow((row) => {
		rows.push(Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text))
	})
	const [header = [], ...data] = rows
	return {
		name: worksheet?.name,
		header,
		rows: data,
		isHeaderBold: worksheet?.getRow(1).getCell(1).font?.bold === true,
		isHeaderFrozen: worksheet?.views[0]?.state === 'frozen',
		cell: (row: number, column: number) => worksheet?.getRow(row).getCell(column).value
	}
}
