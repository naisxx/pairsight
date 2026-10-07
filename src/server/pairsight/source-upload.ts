import 'server-only'
import { MIN_RECORDS, rolesFor, type EntityType } from '@/lib/pairsight/entity-types'
import {
	detectEntityType,
	suggestFields,
	suggestReferenceColumn,
	type TypeDetection
} from '@/lib/pairsight/field-dictionary'
import { saveSourceDataset } from './datasets'
import { duplicateRoles, type FieldRole } from './fields'
import { LIMITS, MAX_LISTED_ISSUES } from './limits'
import {
	columnChecker,
	isUsableReference,
	toSourceRecord,
	type ColumnCheck
} from './source-records'
import { scanTable, type TableError } from './tabular'
import { deleteUpload, readStoredUpload } from './uploads'

// An uploaded records file (uploads.ts) previewed and saved, each in one
// pass over the file a batch of rows at a time, so a file of any size costs
// time, not memory. The records screen's actions call these.

const PREVIEW_ROWS = 10
// The rows whose values back up a column's suggested field and the file's type.
const SAMPLE_ROWS = 50

export type FilePreview =
	| {
			ok: true
			headers: string[]
			sampleRows: string[][]
			rowCount: number
			// Each type's suggested field per column, so switching type on the
			// screen needs no round trip.
			suggestedRoles: Record<EntityType, Record<string, FieldRole>>
			suggestedReference: string | undefined
			detection: Pick<TypeDetection, 'type' | 'confident'>
			sheet: string | undefined
	  }
	| { ok: false; error: TableError }

// The first rows plus field suggestions and the detected type, for the
// mapping screens (src/lib/pairsight/field-dictionary.ts). `rows` is the
// file's first rows (at least SAMPLE_ROWS when it has them).
function previewTable({
	headers,
	rows,
	rowCount,
	sheet
}: {
	headers: string[]
	rows: string[][]
	rowCount: number
	sheet: string | undefined
}): Extract<FilePreview, { ok: true }> {
	const sample = rows.slice(0, SAMPLE_ROWS)
	const reference = suggestReferenceColumn(headers)
	const rolesAs = (type: EntityType): Record<string, FieldRole> => {
		const fields = suggestFields({ headers, rows: sample, type, skip: reference })
		return Object.fromEntries(
			headers.map((header) => [header, fields.get(header)?.role ?? 'other'])
		)
	}
	const { type, confident } = detectEntityType({ headers, rows: sample, skip: reference })
	return {
		ok: true,
		headers,
		sampleRows: rows.slice(0, PREVIEW_ROWS),
		rowCount,
		suggestedRoles: {
			person: rolesAs('person'),
			company: rolesAs('company'),
			product: rolesAs('product')
		},
		suggestedReference: reference,
		detection: { type, confident },
		sheet
	}
}

// Fewer records than PairSight can learn which pairs to check from
// (MIN_RECORDS): refused, as a file over the limit is.
function tooFewRecords(rowCount: number): TableError | null {
	return rowCount < MIN_RECORDS
		? { code: 'too_few_rows', minimum: MIN_RECORDS, found: rowCount }
		: null
}

export type SourcePreview =
	| (Extract<FilePreview, { ok: true }> & { columnChecks: Record<string, ColumnCheck> })
	| Extract<FilePreview, { ok: false }>

// The preview: its first rows, and every column checked as a possible
// record ID.
export async function previewSourceUpload({
	ownerId,
	uploadId,
	sheet,
	maxRows = LIMITS.maxSourceRecords
}: {
	ownerId: string
	uploadId: string
	sheet?: string
	// The record limit; the scale scripts measure past it.
	maxRows?: number
}): Promise<SourcePreview> {
	const upload = await readStoredUpload({ ownerId, uploadId, kind: 'records' })
	const sample: string[][] = []
	let checker: ReturnType<typeof columnChecker> | null = null
	const scan = await scanTable({
		fileName: upload.fileName,
		bytes: upload.bytes,
		maxRows,
		sheet,
		onRows: (rows, firstRowNumber, headers) => {
			for (const row of rows) if (sample.length < SAMPLE_ROWS) sample.push(row)
			checker ??= columnChecker(headers, MAX_LISTED_ISSUES)
			checker.add(rows, firstRowNumber)
		}
	})
	if (!scan.ok) return scan
	const tooFew = tooFewRecords(scan.rowCount)
	if (tooFew != null) return { ok: false, error: tooFew }
	return {
		...previewTable({
			headers: scan.headers,
			rows: sample,
			rowCount: scan.rowCount,
			sheet: scan.sheet
		}),
		columnChecks: (checker ?? columnChecker(scan.headers, MAX_LISTED_ISSUES)).result()
	}
}

export type SaveSourceResult =
	| { ok: true; rowCount: number }
	| { ok: false; parseError: TableError }
	| {
			ok: false
			// The chosen ID column's problems: blanks and repeats.
			referenceCheck: ColumnCheck
			duplicateRoles: string[]
			missingReferenceColumn: boolean
	  }

const NO_PROBLEMS: ColumnCheck = { blank: 0, missing: [], duplicates: [], duplicateCount: 0 }

// Checks the file with the chosen ID column and fields, then saves its
// records as the evaluation's dataset: two passes, the second only once the
// first found nothing wrong. The upload is gone once saved.
export async function saveSourceUpload({
	ownerId,
	evaluationId,
	uploadId,
	sheet,
	referenceColumn,
	columnRoles,
	entityType,
	maxRows = LIMITS.maxSourceRecords
}: {
	ownerId: string
	evaluationId: string
	uploadId: string
	sheet?: string
	referenceColumn: string
	columnRoles: Record<string, FieldRole>
	entityType: EntityType
	// The record limit; the scale scripts measure past it.
	maxRows?: number
}): Promise<SaveSourceResult> {
	const upload = await readStoredUpload({ ownerId, uploadId, kind: 'records' })
	const read = {
		fileName: upload.fileName,
		bytes: upload.bytes,
		maxRows,
		sheet
	}
	// First pass: the file's shape, and the ID column checked on every row.
	const checker = columnChecker([referenceColumn], MAX_LISTED_ISSUES)
	const scan = await scanTable({
		...read,
		onRows: (rows, firstRowNumber, headers) => {
			const index = headers.indexOf(referenceColumn)
			if (index === -1) return
			checker.add(
				rows.map((row) => [row[index] ?? '']),
				firstRowNumber
			)
		}
	})
	if (!scan.ok) return { ok: false, parseError: scan.error }
	const tooFew = tooFewRecords(scan.rowCount)
	if (tooFew != null) return { ok: false, parseError: tooFew }
	const referenceIndex = scan.headers.indexOf(referenceColumn)
	const referenceCheck =
		referenceIndex === -1 ? NO_PROBLEMS : (checker.result()[referenceColumn] ?? NO_PROBLEMS)
	// Only this type's fields count; a role from another type is "not used".
	const typeRoles = new Set<string>(rolesFor(entityType))
	const roles = Object.fromEntries(
		Object.entries(columnRoles)
			.filter(([header]) => header !== referenceColumn && scan.headers.includes(header))
			.map(([header, role]) => [header, typeRoles.has(role) ? role : 'other'] as const)
	)
	const duplicated = duplicateRoles(roles)
	if (referenceIndex === -1 || !isUsableReference(referenceCheck) || duplicated.length > 0) {
		return {
			ok: false,
			referenceCheck,
			duplicateRoles: duplicated,
			missingReferenceColumn: referenceIndex === -1
		}
	}
	// Second pass: the records, written a batch at a time.
	await saveSourceDataset({
		ownerId,
		evaluationId,
		fileName: upload.fileName.trim(),
		referenceColumn,
		columnRoles: roles,
		rowCount: scan.rowCount,
		entityType,
		readRecords: async (write) => {
			await scanTable({
				...read,
				onRows: (rows, firstRowNumber) =>
					write(
						rows.map((row, offset) =>
							toSourceRecord({
								headers: scan.headers,
								row,
								rowNumber: firstRowNumber + offset,
								referenceIndex
							})
						)
					)
			})
		}
	})
	await deleteUpload(uploadId)
	return { ok: true, rowCount: scan.rowCount }
}
