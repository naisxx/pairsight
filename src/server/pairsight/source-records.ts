import { FIRST_DATA_ROW, type Table } from './tabular'

// Source-record validation, on a table read by the tabular connector
// (./tabular). Pure: returns data or issues, never throws on bad input. Row
// numbers are the spreadsheet line numbers a user sees (header = 1, first
// data row = 2).

export type SourceRecordInput = {
	reference: string
	rowNumber: number
	values: Record<string, string>
}

export type ReferenceIssues = {
	missing: number[]
	duplicates: Array<{ reference: string; rows: number[] }>
}

export type SourceValidation = {
	records: SourceRecordInput[]
	issues: ReferenceIssues
	isValid: boolean
}

export function validateSourceRecords({
	table,
	referenceColumn
}: {
	table: Table
	referenceColumn: string
}): SourceValidation {
	const referenceIndex = table.headers.indexOf(referenceColumn)
	const rowsByReference = new Map<string, number[]>()
	const missing: number[] = []
	const records = table.rows.map((row, index) => {
		const rowNumber = index + FIRST_DATA_ROW
		const reference = referenceIndex === -1 ? '' : (row[referenceIndex] ?? '')
		if (reference === '') missing.push(rowNumber)
		else rowsByReference.set(reference, [...(rowsByReference.get(reference) ?? []), rowNumber])
		return {
			reference,
			rowNumber,
			values: Object.fromEntries(table.headers.map((header, column) => [header, row[column] ?? '']))
		}
	})
	const duplicates = [...rowsByReference.entries()]
		.filter(([, rows]) => rows.length > 1)
		.map(([reference, rows]) => ({ reference, rows }))
	return {
		records,
		issues: { missing, duplicates },
		isValid: referenceIndex !== -1 && missing.length === 0 && duplicates.length === 0
	}
}

// How each column would do as the record reference, plus how many of its
// values are blank, so the mapping screen can check a choice as it's made
// without sending the file again. Lists stop at `maxListed`; the counts don't.
export type ColumnCheck = {
	blank: number
	missing: number[]
	duplicates: Array<{ reference: string; rows: number[] }>
	duplicateCount: number
}

export function checkColumns(table: Table, maxListed: number): Record<string, ColumnCheck> {
	return Object.fromEntries(
		table.headers.map((header) => {
			const { issues } = validateSourceRecords({ table, referenceColumn: header })
			return [
				header,
				{
					blank: issues.missing.length,
					missing: issues.missing.slice(0, maxListed),
					duplicates: issues.duplicates.slice(0, maxListed),
					duplicateCount: issues.duplicates.length
				}
			]
		})
	)
}
