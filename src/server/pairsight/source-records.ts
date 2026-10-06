import type { Table } from './tabular'
import { FIRST_DATA_ROW } from './tabular'

// Source-record checks, on rows read by the tabular connector (./tabular), a
// batch at a time so a file of any size is checked in one pass. Pure:
// returns data or issues, never throws on bad input. Row numbers are the
// spreadsheet line numbers a user sees (header = 1, first data row = 2).

export type SourceRecordInput = {
	reference: string
	rowNumber: number
	values: Record<string, string>
}

// How a column would do as the record ID: how many rows leave it blank, and
// how many IDs repeat. Lists stop at `maxListed`; the counts don't. Each
// repeated ID lists its first rows and says how many rows it's on, so a
// value on thousands of rows (a city chosen as the ID) stays a short line.
export type ColumnCheck = {
	blank: number
	missing: number[]
	duplicates: Array<{ reference: string; rows: number[]; count: number }>
	duplicateCount: number
}

// A column's tally: blanks, and each value's row, or rows once it repeats.
type Tally = { blank: number; missing: number[]; seen: Map<string, number | number[]> }

// Every column checked as the ID at once, fed a batch of rows at a time:
// one pass over the file, linear in its cells.
export function columnChecker(headers: string[], maxListed: number) {
	const tallies: Tally[] = headers.map(() => ({ blank: 0, missing: [], seen: new Map() }))
	return {
		add(rows: string[][], firstRowNumber: number) {
			rows.forEach((row, offset) => {
				const rowNumber = firstRowNumber + offset
				tallies.forEach((tally, column) => {
					const value = row[column] ?? ''
					if (value === '') {
						tally.blank++
						if (tally.missing.length < maxListed) tally.missing.push(rowNumber)
						return
					}
					const earlier = tally.seen.get(value)
					if (earlier == null) tally.seen.set(value, rowNumber)
					else if (typeof earlier === 'number') tally.seen.set(value, [earlier, rowNumber])
					else earlier.push(rowNumber)
				})
			})
		},
		result(): Record<string, ColumnCheck> {
			return Object.fromEntries(
				headers.map((header, column) => {
					const tally = tallies[column] ?? { blank: 0, missing: [], seen: new Map() }
					const duplicates: ColumnCheck['duplicates'] = []
					let duplicateCount = 0
					for (const [reference, rows] of tally.seen) {
						if (typeof rows === 'number') continue
						duplicateCount++
						if (duplicates.length < maxListed) {
							duplicates.push({ reference, rows: rows.slice(0, maxListed), count: rows.length })
						}
					}
					return [
						header,
						{ blank: tally.blank, missing: tally.missing, duplicates, duplicateCount }
					]
				})
			)
		}
	}
}

// A whole table's column checks (tests, and small files read whole).
export function checkColumns(table: Table, maxListed: number): Record<string, ColumnCheck> {
	const checker = columnChecker(table.headers, maxListed)
	checker.add(table.rows, FIRST_DATA_ROW)
	return checker.result()
}

// Whether a column's check lets it be the record ID: every row has one, and
// no two rows share one.
export function isUsableReference(check: ColumnCheck | undefined): boolean {
	return check != null && check.blank === 0 && check.duplicateCount === 0
}

// One row as a record to save, its values keyed by header.
export function toSourceRecord({
	headers,
	row,
	rowNumber,
	referenceIndex
}: {
	headers: string[]
	row: string[]
	rowNumber: number
	referenceIndex: number
}): SourceRecordInput {
	return {
		reference: row[referenceIndex] ?? '',
		rowNumber,
		values: Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))
	}
}
