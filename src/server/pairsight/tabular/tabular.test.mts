import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { LIMITS } from '../limits'
import { readTable, scanTable, writeTable, type Table } from './index'
import { metadataFirst } from './xlsx'
import { streamTable } from './stream'

const BOM = '﻿'
// Decoded as written: a default TextDecoder would drop the byte-order mark.
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)

test('CSV is written as UTF-8 with a byte-order mark, CRLF lines and quoted cells', async () => {
	const text = decode(
		await writeTable(
			{
				headers: ['ref', 'name'],
				rows: [
					['R1', 'Smith, Jane'],
					['R2', 'Line one\nline two'],
					['R3', 'Say "hi"']
				]
			},
			'csv'
		)
	)
	assert.ok(text.startsWith(BOM))
	assert.equal(
		text.slice(BOM.length),
		'ref,name\r\nR1,"Smith, Jane"\r\nR2,"Line one\nline two"\r\nR3,"Say ""hi"""\r\n'
	)
})

test('a cell a spreadsheet would run as a formula is written inert', async () => {
	const text = decode(
		await writeTable(
			{
				headers: ['=cmd', 'b'],
				rows: [
					['=1+1', '+SUM(A1)'],
					['-2', '@x']
				]
			},
			'csv'
		)
	)
	assert.equal(text.slice(BOM.length), "'=cmd,b\r\n'=1+1,'+SUM(A1)\r\n'-2,'@x\r\n")
})

test('what is written reads back as the same table', async () => {
	const table: Table = {
		headers: ['ref', 'name', 'note'],
		rows: [
			['R1', 'Jäne Smith', 'comma, inside'],
			['R2', 'Bo', 'quote " inside']
		]
	}
	const bytes = await writeTable(table, 'csv')
	const read = await readTable({ fileName: 'x.csv', bytes, maxRows: 10 })
	assert.deepEqual(read, { ok: true, table })
})

test('the column limit and unsupported formats are reported, not thrown', async () => {
	const headers = Array.from({ length: LIMITS.maxColumns + 1 }, (_, index) => `c${index}`)
	const bytes = new TextEncoder().encode(
		`${headers.join(',')}\n${headers.map(() => 'v').join(',')}`
	)
	assert.deepEqual(await readTable({ fileName: 'wide.csv', bytes, maxRows: 10 }), {
		ok: false,
		error: { code: 'too_many_columns', limit: LIMITS.maxColumns, found: LIMITS.maxColumns + 1 }
	})
	assert.deepEqual(await readTable({ fileName: 'records.xls', bytes, maxRows: 10 }), {
		ok: false,
		error: { code: 'unsupported_format' }
	})
})

// A workbook built in memory, one sheet per entry, rows as given.
async function workbook(sheets: Record<string, ExcelJS.CellValue[][]>): Promise<Uint8Array> {
	const book = new ExcelJS.Workbook()
	for (const [name, rows] of Object.entries(sheets)) book.addWorksheet(name).addRows(rows)
	return new Uint8Array(await book.xlsx.writeBuffer())
}

test('an Excel sheet reads as the text a person sees in each cell', async () => {
	const bytes = await workbook({
		Records: [
			['ref', 'zip', 'joined', 'seen', 'total', 'name', 'active', 'check', 'site'],
			[
				'R1',
				94110,
				new Date(Date.UTC(2026, 0, 5)),
				new Date(Date.UTC(2026, 0, 5, 9, 30)),
				{ formula: '1+1', result: 2 },
				{ richText: [{ text: 'Jane ' }, { font: { bold: true }, text: 'Smith' }] },
				true,
				{ error: '#N/A' },
				{ text: 'example.test', hyperlink: 'https://example.test' }
			],
			['R2', 10],
			[],
			['R3']
		]
	})
	assert.deepEqual(await readTable({ fileName: 'records.xlsx', bytes, maxRows: 10 }), {
		ok: true,
		sheet: 'Records',
		table: {
			headers: ['ref', 'zip', 'joined', 'seen', 'total', 'name', 'active', 'check', 'site'],
			rows: [
				[
					'R1',
					'94110',
					'2026-01-05',
					'2026-01-05 09:30',
					'2',
					'Jane Smith',
					'TRUE',
					'',
					'example.test'
				],
				['R2', '10', '', '', '', '', '', '', ''],
				['R3', '', '', '', '', '', '', '', '']
			]
		}
	})
})

test('a workbook with several sheets of data asks which one; naming it reads that one', async () => {
	const bytes = await workbook({
		Notes: [['just a title']],
		Customers: [['ref'], ['C1'], ['C2']],
		Archive: [['ref'], ['A1']]
	})
	assert.deepEqual(await readTable({ fileName: 'book.xlsx', bytes, maxRows: 10 }), {
		ok: false,
		error: {
			code: 'choose_sheet',
			sheets: [
				{ name: 'Customers', rows: 2 },
				{ name: 'Archive', rows: 1 }
			]
		}
	})
	assert.deepEqual(
		await readTable({ fileName: 'book.xlsx', bytes, maxRows: 10, sheet: 'Archive' }),
		{
			ok: true,
			sheet: 'Archive',
			table: { headers: ['ref'], rows: [['A1']] }
		}
	)
	const gone = await readTable({ fileName: 'book.xlsx', bytes, maxRows: 10, sheet: 'Old' })
	assert.equal(!gone.ok && gone.error.code, 'choose_sheet')
})

test('an Excel sheet over the row limit gives its true row count', async () => {
	const rows = Array.from({ length: 7 }, (_, index) => [`R${index}`])
	const bytes = await workbook({ Sheet1: [['ref'], ...rows] })
	assert.deepEqual(await readTable({ fileName: 'big.xlsx', bytes, maxRows: 3 }), {
		ok: false,
		error: { code: 'too_many_rows', limit: 3, found: 7 }
	})
})

test('a file that is not really a workbook is unreadable, not thrown', async () => {
	const bytes = new TextEncoder().encode('ref,name\nR1,Ann\n')
	assert.deepEqual(await readTable({ fileName: 'renamed.xlsx', bytes, maxRows: 10 }), {
		ok: false,
		error: { code: 'unreadable' }
	})
})

test('the Excel export reads back as the same table, formatted for reading', async () => {
	const table: Table = {
		headers: ['ref', 'score', 'note'],
		rows: [
			['00123', '0.92', '=1+1'],
			['R2', '0.50', 'Jäne, "quoted"']
		]
	}
	const bytes = await writeTable(table, 'xlsx')
	assert.deepEqual(await readTable({ fileName: 'x.xlsx', bytes, maxRows: 10 }), {
		ok: true,
		sheet: 'Findings',
		table
	})

	const book = new ExcelJS.Workbook()
	await book.xlsx.load(new Uint8Array(bytes).buffer)
	const sheet = book.getWorksheet('Findings')
	assert.ok(sheet)
	assert.equal(sheet.getRow(1).getCell(1).font?.bold, true)
	assert.equal(sheet.views[0]?.state, 'frozen')
	assert.deepEqual(sheet.autoFilter, 'A1:C1')
	assert.equal(sheet.getCell('B2').value, 0.92)
	assert.equal(sheet.getCell('A2').value, '00123')
	assert.equal(sheet.getCell('C2').value, '=1+1')
})

test('a workbook that declares it unpacks too large is refused before unpacking', async () => {
	const bytes = await workbook({ Sheet1: [['ref'], ['R1']] })
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const entry = bytes.findIndex(
		(_, at) => at + 4 <= bytes.length && view.getUint32(at, true) === 0x02014b50
	)
	view.setUint32(entry + 24, 0xffffffff, true)
	assert.deepEqual(await readTable({ fileName: 'bomb.xlsx', bytes, maxRows: 10 }), {
		ok: false,
		error: { code: 'unreadable' }
	})
})

// A table's rows as pages, the way the findings download reads them.
async function* inPages(rows: string[][], size: number) {
	for (let at = 0; at < rows.length; at += size) yield rows.slice(at, at + size)
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	return new Uint8Array(await new Response(stream).arrayBuffer())
}

test('a streamed file is the same as one written whole', async () => {
	const table: Table = {
		headers: ['ref', 'score', 'note'],
		rows: Array.from({ length: 7 }, (_, index) => [
			`R${index}`,
			(index / 10).toFixed(2),
			index % 2 === 0 ? 'Smith, "Jane"' : '=SUM(A1)'
		])
	}
	const csv = await collect(
		streamTable({ headers: table.headers, pages: inPages(table.rows, 3), format: 'csv' })
	)
	assert.equal(decode(csv), decode(await writeTable(table, 'csv')))

	const xlsx = await collect(
		streamTable({ headers: table.headers, pages: inPages(table.rows, 3), format: 'xlsx' })
	)
	assert.deepEqual(await readTable({ fileName: 'x.xlsx', bytes: xlsx, maxRows: 10 }), {
		ok: true,
		sheet: 'Findings',
		table
	})
	const book = new ExcelJS.Workbook()
	await book.xlsx.load(new Uint8Array(xlsx).buffer)
	const sheet = book.getWorksheet('Findings')
	assert.ok(sheet)
	assert.equal(sheet.getRow(1).getCell(1).font?.bold, true)
	assert.equal(sheet.views[0]?.state, 'frozen')
	assert.deepEqual(sheet.autoFilter, 'A1:C1')
	assert.equal(sheet.getCell('B3').value, 0.1)

	// No pairs: just the header.
	const empty = await collect(
		streamTable({ headers: table.headers, pages: inPages([], 3), format: 'csv' })
	)
	assert.equal(decode(empty), `${BOM}ref,score,note\r\n`)
})

test('a big workbook is read a batch at a time, the same as whole', async () => {
	const rows = Array.from({ length: 5_000 }, (_, index) => [`R${index}`, `Name ${index}`])
	const bytes = await workbook({ People: [['ref', 'name'], ...rows] })
	const batches: number[] = []
	const scan = await scanTable({
		fileName: 'people.xlsx',
		bytes,
		maxRows: 10_000,
		onRows: (batch, firstRowNumber) => {
			batches.push(firstRowNumber)
		}
	})
	assert.deepEqual(scan, { ok: true, headers: ['ref', 'name'], rowCount: 5_000, sheet: 'People' })
	assert.ok(batches.length > 1)
	assert.equal(batches[0], 2)
	const whole = await readTable({ fileName: 'people.xlsx', bytes, maxRows: 10_000 })
	assert.ok(whole.ok)
	assert.deepEqual(whole.table.rows, rows)
})

test('reordering a workbook’s zip moves its metadata first and changes nothing else', async () => {
	const bytes = await workbook({
		Records: [
			['ref', 'name'],
			['R1', 'Ann']
		]
	})
	const reordered = metadataFirst(bytes)
	assert.ok(reordered != null)
	assert.equal(reordered.length, bytes.length)
	// ExcelJS writes the sheet list last; reordered, it comes first.
	const names = (zip: Uint8Array) => {
		const text = new TextDecoder('latin1').decode(zip)
		return ['xl/workbook.xml', 'xl/worksheets/sheet1.xml'].map((name) => text.indexOf(name))
	}
	const [listBefore = 0, sheetBefore = 0] = names(bytes)
	const [listAfter = 0, sheetAfter = 0] = names(reordered)
	assert.ok(listBefore > sheetBefore)
	assert.ok(listAfter < sheetAfter)
	// Still a workbook any reader opens the same.
	const book = new ExcelJS.Workbook()
	await book.xlsx.load(new Uint8Array(reordered).buffer)
	assert.equal(book.getWorksheet('Records')?.getCell('B2').value, 'Ann')
	assert.equal(metadataFirst(new TextEncoder().encode('not a zip')), null)
})
