import { z } from 'zod'
import { labelFor, type EntityType } from '@/lib/pairsight/entity-types'
import { PAGE_SIZES, SEARCH_MAX_LENGTH } from '@/lib/pairsight/input-limits'
import { categorize, CATEGORIES, isLowConfidence, type Category } from './decisions'
import { mapRecordFields, type FieldRole } from './fields'

// Pure building blocks of the Results and Pair detail screens: filters, rows,
// the one shared definition of "the current list" (filter + sort), and counts.
// Categories are computed here from the run's current threshold, so a
// threshold change never calls Jev.

export const PAGE_SIZE = PAGE_SIZES[0]

// "r:0.3-0.4" is one 0.1-wide score range (a bar of the score histogram).
const SCORE_RANGE = /^r:(0(?:\.\d+)?|1(?:\.0+)?)-(0(?:\.\d+)?|1(?:\.0+)?)$/

export const resultFiltersSchema = z.object({
	vendor: z.string().uuid().optional(),
	// `disagreements` is PairSight only and vendor only together.
	category: z.enum([...CATEGORIES, 'incomplete', 'disagreements']).optional(),
	source: z.enum(['rules', 'vendor']).optional(),
	lowConfidence: z.literal('1').optional(),
	// Judged pairs; not judged yet or failed (incomplete); or just one of those.
	status: z.enum(['evaluated', 'incomplete', 'pending', 'failed']).optional(),
	// PairSight's decision side of the threshold, the low-confidence band
	// around it, or a score range.
	score: z.union([z.enum(['below', 'above', 'near']), z.string().regex(SCORE_RANGE)]).optional(),
	q: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
	page: z.coerce.number().int().min(1).optional(),
	// View state that travels with the list, not filters.
	tab: z.literal('detailed').optional(),
	sort: z.enum(['score-desc', 'score-asc']).optional(),
	// The pair just inspected, highlighted on the way back.
	sel: z.string().uuid().optional(),
	size: z.coerce
		.number()
		.refine((value) => PAGE_SIZES.some((size) => size === value))
		.optional()
})

export type ResultFilters = z.infer<typeof resultFiltersSchema>

// Each URL param is checked on its own: an invalid or empty one (a GET form
// submits "All" selects as `source=`) is ignored without dropping the rest.
const { shape } = resultFiltersSchema
const lenientFiltersSchema = z.object({
	vendor: shape.vendor.catch(undefined),
	category: shape.category.catch(undefined),
	source: shape.source.catch(undefined),
	lowConfidence: shape.lowConfidence.catch(undefined),
	status: shape.status.catch(undefined),
	score: shape.score.catch(undefined),
	q: shape.q.catch(undefined),
	page: shape.page.catch(undefined),
	tab: shape.tab.catch(undefined),
	sort: shape.sort.catch(undefined),
	sel: shape.sel.catch(undefined),
	size: shape.size.catch(undefined)
	// Fails to compile if a filter is added above but not here.
} satisfies Record<keyof ResultFilters, z.ZodType>)

export function parseResultFilters(raw: unknown): ResultFilters {
	const parsed = lenientFiltersSchema.safeParse(raw)
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

// How a record is named on screen and in exports: its type's label fields
// (a person's name, an organisation's name, a product's brand and name), or
// its reference when those are empty.
export function recordLabel({
	values,
	columnRoles,
	reference,
	entityType
}: {
	values: Record<string, string>
	columnRoles: Record<string, FieldRole>
	reference: string
	entityType: EntityType
}): string {
	return labelFor(entityType, mapRecordFields({ values, columnRoles })) ?? reference
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

function matchesCategory(row: ResultRow, category: ResultFilters['category']): boolean {
	if (category == null) return true
	if (category === 'disagreements') {
		return row.category === 'pairsight_only' || row.category === 'vendor_only'
	}
	return row.category === category
}

function matchesScore(row: ResultRow, score: ResultFilters['score']): boolean {
	if (score == null) return true
	if (row.score == null || row.status !== 'succeeded') return false
	if (score === 'near') return row.isLowConfidence
	// At or above the threshold is exactly a PairSight match.
	const isMatch = row.category === 'both_matched' || row.category === 'pairsight_only'
	if (score === 'above') return isMatch
	if (score === 'below') return !isMatch
	const range = SCORE_RANGE.exec(score)
	const from = Number(range?.[1])
	const to = Number(range?.[2])
	// The last range includes a perfect 1.
	return row.score >= from && (row.score < to || (to === 1 && row.score === 1))
}

function matchesStatus(row: ResultRow, status: ResultFilters['status']): boolean {
	switch (status) {
		case undefined:
			return true
		case 'evaluated':
			return row.status === 'succeeded'
		case 'incomplete':
			return row.status !== 'succeeded'
		case 'pending':
			return row.status === 'pending' || row.status === 'running'
		case 'failed':
			return row.status === 'failed'
	}
}

export function applyFilters(rows: ResultRow[], filters: ResultFilters): ResultRow[] {
	const query = filters.q?.toLowerCase()
	return rows
		.filter((row) => matchesCategory(row, filters.category))
		.filter((row) => matchesScore(row, filters.score))
		.filter(
			(row) =>
				filters.source == null ||
				(filters.source === 'rules' ? row.ruleIds.length > 0 : row.ruleIds.length === 0)
		)
		.filter((row) => filters.lowConfidence == null || row.isLowConfidence)
		.filter((row) => matchesStatus(row, filters.status))
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
		.sort((x, y) => {
			// Sorting by score keeps incomplete pairs (no score) at the end.
			if (filters.sort != null) {
				const direction = filters.sort === 'score-asc' ? 1 : -1
				if (x.score == null || y.score == null) return x.score == null ? 1 : -1
				return direction * (x.score - y.score)
			}
			return (
				CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category) ||
				(y.score ?? -1) - (x.score ?? -1) ||
				x.recordA.reference.localeCompare(y.recordA.reference, undefined, { numeric: true })
			)
		})
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
