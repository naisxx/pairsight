import { PassThrough } from 'node:stream'
import { once } from 'node:events'
import ExcelJS from 'exceljs'
import type { TabularFormat } from '@/lib/pairsight/tabular-formats'
import { csvLines, CSV_START } from './csv'
import { applyDecimals, columnWidth, SHEET_NAME } from './xlsx'

// A table written as it's read, a page of rows at a time, so a download of
// any size streams to the browser in flat memory. Each format writes exactly
// what its whole-table encoder does (csv.ts, xlsx.ts).

export type RowPages = AsyncIterable<string[][]>

function csvStream(headers: string[], pages: RowPages): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder()
	const iterator = pages[Symbol.asyncIterator]()
	let started = false
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (!started) {
				started = true
				controller.enqueue(encoder.encode(`${CSV_START}${csvLines([headers])}`))
				return
			}
			const next = await iterator.next()
			if (next.done === true) {
				controller.close()
				return
			}
			if (next.value.length > 0) controller.enqueue(encoder.encode(csvLines(next.value)))
		},
		async cancel() {
			await iterator.return?.()
		}
	})
}

// The Node stream ExcelJS writes to, as the web stream a response sends.
function toWebStream(output: PassThrough): ReadableStream<Uint8Array> {
	const chunks = output[Symbol.asyncIterator]()
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const next = await chunks.next()
			if (next.done === true) controller.close()
			else if (Buffer.isBuffer(next.value)) controller.enqueue(new Uint8Array(next.value))
		},
		cancel() {
			output.destroy()
		}
	})
}

function xlsxStream(headers: string[], pages: RowPages): ReadableStream<Uint8Array> {
	const output = new PassThrough()
	const write = async () => {
		const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true })
		const worksheet = workbook.addWorksheet(SHEET_NAME, {
			views: [{ state: 'frozen', ySplit: 1 }]
		})
		// The header row, with widths from the header and the first page: the
		// rest is never held at once.
		const start = (rows: string[][]) => {
			worksheet.columns = headers.map((header, index) => ({
				header,
				width: columnWidth({ headers, rows }, index)
			}))
			worksheet.getRow(1).font = { bold: true }
			worksheet.autoFilter = {
				from: { row: 1, column: 1 },
				to: { row: 1, column: headers.length }
			}
			worksheet.getRow(1).commit()
		}
		let started = false
		for await (const rows of pages) {
			if (!started) {
				started = true
				start(rows)
			}
			for (const values of rows) {
				const row = worksheet.addRow(values)
				applyDecimals(row, values)
				row.commit()
			}
			// Wait for the browser to take what's written before reading on.
			if (output.writableNeedDrain) await once(output, 'drain')
		}
		if (!started) start([])
		worksheet.commit()
		await workbook.commit()
	}
	write().catch((error: unknown) =>
		output.destroy(error instanceof Error ? error : new Error(String(error)))
	)
	return toWebStream(output)
}

export function streamTable({
	headers,
	pages,
	format
}: {
	headers: string[]
	pages: RowPages
	format: TabularFormat
}): ReadableStream<Uint8Array> {
	return format === 'csv' ? csvStream(headers, pages) : xlsxStream(headers, pages)
}
