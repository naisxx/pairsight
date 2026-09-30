import { z } from 'zod'
import { SEARCH_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { categorize, CATEGORIES, isLowConfidence, type Category } from './decisions'
import { mapRecordFields, type FieldRole } from './fields'

// Pure building blocks of the Results and Pair detail screens: filters, rows,
// the one shared definition of "the current list" (filter + sort), and counts.
// Categories are computed here from the run's current threshold, so a
// threshold change never calls Jev.

export const PAGE_SIZE = 50

export const resultFiltersSchema = z.object({
	vendor: z.string().uuid().optional(),
	category: z.enum([...CATEGORIES, 'incomplete']).optional(),
	source: z.enum(['rules', 'vendor']).optional(),
	lowConfidence: z.literal('1').optional(),
	q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
	page: z.coerce.number().int().min(1).optional()
})

export type ResultFilters = z.infer<typeof resultFiltersSchema>

// Invalid URL params are ignored rather than erroring the page.
export function parseResultFilters(raw: unknown): ResultFilters {
	const parsed = resultFiltersSchema.safeParse(raw)
	return parsed.success ? parsed.data : {}
}

export type ResultCategory = Category | 'incomplete'
export type CategoryCounts = Record<ResultCategory, number>
export type AssessmentStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type RecordSummary = { id: string; reference: string; label: string }

export type ResultRow = {
	id: string
	category: ResultCategory
	recordA: RecordSummary
	recordB: RecordSummary
	isVendorMatch: boolean
	status: AssessmentStatus
	score: number | null
	errorCode: string | null
	ruleIds: string[]
	isLowConfidence: boolean
}

export type PairInput = {
	id: string
	recordAId: string
	recordBId: string
	ruleIds: string[]
	matchedByExportIds: string[]
	assessment: { status: AssessmentStatus; score: number | null; errorCode: string | null }
}

// Disagreements first — that's where a reviewer's attention goes.
const CATEGORY_ORDER: ResultCategory[] = [
	'pairsight_only',
	'vendor_only',
	'both_matched',
	'neither_matched',
	'incomplete'
]

export function recordLabel({
	values,
	columnRoles,
	reference
}: {
	values: Record<string, string>
	columnRoles: Record<string, FieldRole>
	reference: string
}): string {
	const fields = mapRecordFields({ values, columnRoles })
	const name = fields.full_name ?? [fields.first_name, fields.last_name].filter(Boolean).join(' ')
	return name !== '' ? name : reference
}

// Storage keeps pairs in canonical id order; people read them in reference
// order (R2 before R10).
export function byReference<T extends { reference: string }>(first: T, second: T): [T, T] {
	return first.reference.localeCompare(second.reference, undefined, { numeric: true }) <= 0
		? [first, second]
		: [second, first]
}

export function buildRows({
	pairs,
	records,
	threshold,
	vendorId
}: {
	pairs: PairInput[]
	records: ReadonlyMap<string, RecordSummary>
	threshold: number
	vendorId: string | undefined
}): ResultRow[] {
	const summary = (id: string): RecordSummary =>
		records.get(id) ?? { id, reference: '—', label: '—' }
	return pairs.map((pair) => {
		const isVendorMatch = vendorId != null && pair.matchedByExportIds.includes(vendorId)
		const { status, score, errorCode } = pair.assessment
		const [recordA, recordB] = byReference(summary(pair.recordAId), summary(pair.recordBId))
		return {
			id: pair.id,
			category: categorize({ isVendorMatch, status, score, threshold }),
			recordA,
			recordB,
			isVendorMatch,
			status,
			score,
			errorCode,
			ruleIds: pair.ruleIds,
			isLowConfidence:
				status === 'succeeded' && score != null && isLowConfidence({ score, threshold })
		}
	})
}

export function applyFilters(rows: ResultRow[], filters: ResultFilters): ResultRow[] {
	const query = filters.q?.toLowerCase()
	return rows
		.filter((row) => filters.category == null || row.category === filters.category)
		.filter(
			(row) =>
				filters.source == null ||
				(filters.source === 'rules' ? row.ruleIds.length > 0 : row.ruleIds.length === 0)
		)
		.filter((row) => filters.lowConfidence == null || row.isLowConfidence)
		.filter(
			(row) =>
				query == null ||
				query === '' ||
				[row.recordA, row.recordB].some(
					(record) =>
						record.reference.toLowerCase().includes(query) ||
						record.label.toLowerCase().includes(query)
				)
		)
		.sort(
			(x, y) =>
				CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) ||
				(y.score ?? -1) - (x.score ?? -1) ||
				x.recordA.reference.localeCompare(y.recordA.reference, undefined, { numeric: true })
		)
}

export function countCategories(rows: ResultRow[]): CategoryCounts {
	const counts: CategoryCounts = {
		pairsight_only: 0,
		vendor_only: 0,
		both_matched: 0,
		neither_matched: 0,
		incomplete: 0
	}
	for (const row of rows) counts[row.category]++
	return counts
}

// The requested vendor if it's part of this run, else the first one.
export function pickVendorId(
	vendors: Array<{ id: string }>,
	requested: string | undefined
): string | undefined {
	return vendors.some((vendor) => vendor.id === requested) ? requested : vendors[0]?.id
}
