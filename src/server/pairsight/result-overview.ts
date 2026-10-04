import {
	emptyCounts,
	histogram,
	possiblePairs,
	sensitivity,
	stableRange,
	vendorMetrics,
	vendorOverlap,
	workload,
	type CategoryCounts,
	type MetricPair,
	type ResultCategory
} from '@/lib/pairsight/metrics'
import { isPairsightMatch, type Category } from '@/lib/pairsight/decisions'
import { compareFields } from './compare'
import type { FieldRole, IdentityRole } from './fields'
import { isFuzzyOnly, type AssessmentStatus, type ResultRow } from './result-rows'

// The Results overview (docs/PairSight-UX-Plan.md §4.1), built from the
// pairs and rows getRunResults already loaded: no extra queries. Pure, so
// it's unit-tested without a database.

export type OverviewPair = {
	matchedByExportIds: string[]
	ruleIds: string[]
	assessment: { status: AssessmentStatus; score: number | null }
}

const TOP_DISAGREEMENTS = 3
// A field "usually" matches within a category at or above this share of
// pairs, and "usually differs" at or below the mirror share.
const USUALLY_SHARED = 0.6
const USUALLY_DIFFERENT = 0.4
const SUMMARY_FIELDS = 2

export type FieldPatternCell = { same: number; total: number; share: number }
export type FieldPatterns = {
	columns: Array<{ category: Category; count: number }>
	rows: Array<{ role: IdentityRole; cells: Partial<Record<Category, FieldPatternCell>> }>
	// The fields each disagreement category usually shares and usually differs
	// on, for the one-line readings under the table.
	summary: Partial<
		Record<'pairsight_only' | 'vendor_only', { shared: IdentityRole[]; different: IdentityRole[] }>
	>
}

const ASSESSED: Category[] = ['both_matched', 'pairsight_only', 'vendor_only', 'neither_matched']

// How often each field agrees between the two records, per category. A pair
// missing the value on either side doesn't count for that field.
export function fieldPatterns({
	rows,
	records,
	columnRoles,
	country
}: {
	rows: ResultRow[]
	records: ReadonlyMap<string, { values: Record<string, string> }>
	columnRoles: Record<string, FieldRole>
	country: string
}): FieldPatterns {
	const byCategory = new Map<Category, ResultRow[]>(ASSESSED.map((category) => [category, []]))
	for (const row of rows) {
		if (row.category !== 'incomplete') byCategory.get(row.category)?.push(row)
	}
	const columns = ASSESSED.flatMap((category) => {
		const count = byCategory.get(category)?.length ?? 0
		return count === 0 ? [] : [{ category, count }]
	})

	const tallies = new Map<IdentityRole, Partial<Record<Category, FieldPatternCell>>>()
	for (const { category } of columns) {
		for (const row of byCategory.get(category) ?? []) {
			const valuesA = records.get(row.recordA.id)?.values
			const valuesB = records.get(row.recordB.id)?.values
			if (valuesA == null || valuesB == null) continue
			for (const field of compareFields({ valuesA, valuesB, columnRoles, country }).fields) {
				if (field.comparison === 'oneMissing' || field.comparison === 'bothMissing') continue
				const cells = tallies.get(field.role) ?? {}
				const cell = cells[category] ?? { same: 0, total: 0, share: 0 }
				cell.total++
				if (field.comparison === 'same') cell.same++
				cell.share = cell.same / cell.total
				cells[category] = cell
				tallies.set(field.role, cells)
			}
		}
	}

	const patternRows = [...tallies].map(([role, cells]) => ({ role, cells }))
	const pick = (category: Category, shared: boolean) =>
		patternRows
			.flatMap(({ role, cells }) => {
				const cell = cells[category]
				return cell == null ? [] : [{ role, share: cell.share }]
			})
			.filter(({ share }) => (shared ? share >= USUALLY_SHARED : share <= USUALLY_DIFFERENT))
			.sort((a, b) => (shared ? b.share - a.share : a.share - b.share))
			.slice(0, SUMMARY_FIELDS)
			.map(({ role }) => role)
	const summary: FieldPatterns['summary'] = {}
	for (const category of ['pairsight_only', 'vendor_only'] as const) {
		if (!columns.some((column) => column.category === category)) continue
		const shared = pick(category, true)
		if (shared.length > 0) summary[category] = { shared, different: pick(category, false) }
	}
	return { columns, rows: patternRows, summary }
}

export type SourceRow = { ruleId: string | null; counts: CategoryCounts; total: number }

// Which rules surfaced each kind of pair. A pair found by several rules
// counts once under each; pairs outside every rule sit under "added by a
// vendor" (ruleId null), listed last.
export function sourceBreakdown(rows: ResultRow[]): SourceRow[] {
	const byRule = new Map<string | null, SourceRow>()
	const add = (ruleId: string | null, category: ResultCategory) => {
		const row = byRule.get(ruleId) ?? { ruleId, counts: emptyCounts(), total: 0 }
		row.counts[category]++
		row.total++
		byRule.set(ruleId, row)
	}
	for (const row of rows) {
		if (row.ruleIds.length === 0) add(null, row.category)
		else for (const ruleId of row.ruleIds) add(ruleId, row.category)
	}
	return [...byRule.values()].sort((a, b) =>
		(a.ruleId == null) === (b.ruleId == null) ? b.total - a.total : a.ruleId == null ? 1 : -1
	)
}

export type HardCases = {
	// Pairs only fuzzy rules found, and those Jev confirmed as duplicates.
	found: number
	confirmed: number
	byVendor: Array<{ id: string; caught: number }>
}

// The duplicates exact rules would have missed: found only by fuzzy rules,
// confirmed by Jev, and how many of them each vendor caught. The fairest
// reading of who handles hard cases (typos, a move, a new email).
export function hardCases({
	pairs,
	fuzzyRuleIds,
	vendors,
	threshold
}: {
	pairs: ReadonlyArray<Pick<OverviewPair, 'ruleIds' | 'matchedByExportIds' | 'assessment'>>
	fuzzyRuleIds: ReadonlySet<string>
	vendors: ReadonlyArray<{ id: string }>
	threshold: number
}): HardCases {
	const fuzzyOnly = pairs.filter((pair) => isFuzzyOnly(pair.ruleIds, fuzzyRuleIds))
	const confirmed = fuzzyOnly.filter(
		({ assessment }) =>
			assessment.status === 'succeeded' &&
			assessment.score != null &&
			isPairsightMatch({ score: assessment.score, threshold })
	)
	return {
		found: fuzzyOnly.length,
		confirmed: confirmed.length,
		byVendor: vendors.map((vendor) => ({
			id: vendor.id,
			caught: confirmed.filter((pair) => pair.matchedByExportIds.includes(vendor.id)).length
		}))
	}
}

// Where to start reviewing: the duplicates the vendor missed that Jev is
// surest about, and the vendor's merges Jev is least sure of.
export function topDisagreements(rows: ResultRow[]) {
	const scored = (category: Category) =>
		rows.filter((row) => row.category === category && row.score != null)
	return {
		missed: scored('pairsight_only')
			.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
			.slice(0, TOP_DISAGREEMENTS),
		merges: scored('vendor_only')
			.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
			.slice(0, TOP_DISAGREEMENTS)
	}
}

export function buildOverview({
	pairs,
	rows,
	vendors,
	vendorId,
	threshold,
	recordCount,
	records,
	columnRoles,
	country,
	fuzzyRuleIds
}: {
	pairs: OverviewPair[]
	rows: ResultRow[]
	vendors: Array<{ id: string; name: string }>
	vendorId: string | undefined
	threshold: number
	recordCount: number
	records: ReadonlyMap<string, { values: Record<string, string> }>
	columnRoles: Record<string, FieldRole>
	country: string
	fuzzyRuleIds: ReadonlySet<string>
}) {
	const metricPairsFor = (id: string): MetricPair[] =>
		pairs.map((pair) => ({
			status: pair.assessment.status,
			score: pair.assessment.score,
			isVendorMatch: pair.matchedByExportIds.includes(id)
		}))
	const selected = vendorId == null ? [] : metricPairsFor(vendorId)
	const metrics = vendorMetrics(selected, threshold)
	const points = sensitivity(selected)
	const other = vendors.find((vendor) => vendor.id !== vendorId)
	const fromRules = rows.filter((row) => row.ruleIds.length > 0).length

	return {
		metrics,
		// Every vendor's metrics, for the other-vendor ticks and the comparison.
		byVendor: vendors.map((vendor) => ({
			...vendor,
			metrics:
				vendor.id === vendorId ? metrics : vendorMetrics(metricPairsFor(vendor.id), threshold)
		})),
		sensitivity: points,
		stableRange: stableRange(points, metrics),
		histogram: histogram(selected),
		// The selected vendor against the first other one (decision #7 in the
		// revamp plan: more than two vendors compare pairwise like this).
		overlap:
			vendorId == null || other == null
				? null
				: {
						vendors: [vendors.find((vendor) => vendor.id === vendorId), other],
						groups: vendorOverlap(
							pairs.map((pair) => ({
								status: pair.assessment.status,
								score: pair.assessment.score,
								matchedBy: pair.matchedByExportIds
							})),
							[vendorId, other.id],
							threshold
						)
					},
		sources: sourceBreakdown(rows),
		hardCases: hardCases({ pairs, fuzzyRuleIds, vendors, threshold }),
		top: topDisagreements(rows),
		workload: workload(selected, threshold),
		coverage: {
			total: rows.length,
			assessed: metrics.assessed,
			pending: metrics.pending,
			failed: metrics.failed,
			fromRules,
			addedByVendor: rows.length - fromRules,
			notCompared: Math.max(0, possiblePairs(recordCount) - rows.length)
		},
		fieldPatterns: fieldPatterns({ rows, records, columnRoles, country })
	}
}

export type ResultsOverview = ReturnType<typeof buildOverview>
