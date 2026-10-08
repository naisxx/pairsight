import { z } from 'zod'
import { possiblePairs, stableRange, type ResultCategory } from '@/lib/pairsight/metrics'
import { CATEGORIES, type Category } from '@/lib/pairsight/decisions'
import {
	binPairs,
	statsCoverage,
	statsMetrics,
	statsSensitivity,
	statsWorkload,
	type StatsRow
} from '@/lib/pairsight/stats'
import { compareFields, type FieldComparison } from './compare'
import { FIELD_ROLES, type FieldRole, type IdentityRole } from './fields'
import type { AssessmentStatus, ResultRow } from './result-rows'
import { identityRoleSchema } from './schemas'

// The Results overview (docs/PairSight-UX-Plan.md §4.1), read from the run's
// summary: exact counts over every pair, worked out once when the run
// finished (run-summary.ts), so the Overview never loads the run. Pure, so
// it's unit-tested without a database; `summarizePairs` builds the same
// summary from pairs in memory, the reference the database's is checked
// against.

export const TOP_DISAGREEMENTS = 3
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

// Same/compared counts per field and category, added to one pair at a time.
export type PatternTallies = Map<
	IdentityRole,
	Partial<Record<Category, { same: number; total: number }>>
>

// One judged pair's field comparisons, counted under its category. A value
// missing on either side doesn't count for that field.
export function tallyPair(tallies: PatternTallies, category: Category, fields: FieldComparison[]) {
	for (const field of fields) {
		if (field.comparison === 'oneMissing' || field.comparison === 'bothMissing') continue
		const cells = tallies.get(field.role) ?? {}
		const cell = cells[category] ?? { same: 0, total: 0 }
		cell.total++
		if (field.comparison === 'same') cell.same++
		cells[category] = cell
		tallies.set(field.role, cells)
	}
}

// The patterns table from the tallies and each category's pair count. Rows
// follow the usual field order.
export function finishFieldPatterns(
	counts: Partial<Record<Category, number>>,
	tallies: PatternTallies
): FieldPatterns {
	const columns = ASSESSED.flatMap((category) => {
		const count = counts[category] ?? 0
		return count === 0 ? [] : [{ category, count }]
	})
	const patternRows = FIELD_ROLES.flatMap((role) => {
		if (role === 'other') return []
		const tally = tallies.get(role)
		if (tally == null) return []
		const cells: Partial<Record<Category, FieldPatternCell>> = {}
		for (const category of ASSESSED) {
			const cell = tally[category]
			if (cell != null) cells[category] = { ...cell, share: cell.same / cell.total }
		}
		return [{ role, cells }]
	})
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

// How often each field agrees between the two records, per category.
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
	const counts: Partial<Record<Category, number>> = {}
	const tallies: PatternTallies = new Map()
	for (const row of rows) {
		if (row.category === 'incomplete') continue
		counts[row.category] = (counts[row.category] ?? 0) + 1
		const valuesA = records.get(row.recordA.id)?.values
		const valuesB = records.get(row.recordB.id)?.values
		if (valuesA == null || valuesB == null) continue
		tallyPair(
			tallies,
			row.category,
			compareFields({ valuesA, valuesB, columnRoles, country }).fields
		)
	}
	return finishFieldPatterns(counts, tallies)
}

// Pairs by where they came from (PairSight suggested them, or only a vendor
// matched them), split by what a category needs: judged, Jev says same,
// which vendors matched.
export type SourceStat = {
	suggested: boolean
	judged: boolean
	match: boolean
	mask: number
	count: number
}

const matchedBy = (mask: number, vendorIndex: number) =>
	vendorIndex >= 0 && (mask & (1 << vendorIndex)) !== 0

function categoryOf(judged: boolean, match: boolean, isVendorMatch: boolean): ResultCategory {
	if (!judged) return 'incomplete'
	if (isVendorMatch) return match ? 'both_matched' : 'vendor_only'
	return match ? 'pairsight_only' : 'neither_matched'
}

const statsRowSchema = z.object({
	status: z.enum(['pending', 'running', 'succeeded', 'failed']),
	bin: z.number().int().nullable(),
	match: z.boolean(),
	near: z.boolean(),
	mask: z.number().int(),
	suggested: z.boolean(),
	count: z.number().int()
})

const fieldPatternsSchema = z.object({
	columns: z.array(z.object({ category: z.enum(CATEGORIES), count: z.number().int() })),
	rows: z.array(
		z.object({
			role: identityRoleSchema,
			cells: z.partialRecord(
				z.enum(CATEGORIES),
				z.object({ same: z.number(), total: z.number(), share: z.number() })
			)
		})
	),
	summary: z.partialRecord(
		z.enum(['pairsight_only', 'vendor_only']),
		z.object({ shared: z.array(identityRoleSchema), different: z.array(identityRoleSchema) })
	)
})

// Bump when the shape or the way it's counted changes: older summaries are
// then rebuilt on their next read.
// 2: building one also copies each pair's judgment onto run_pairs.
// 3: pairs come from PairSight's suggestions or a vendor, not rules.
export const RUN_SUMMARY_VERSION = 3

// Everything the Overview, the dashboard and the summary report show,
// stored on the run (runs.summary).
export const runSummarySchema = z.object({
	// What it was counted at; a mismatch with the run means it's rebuilt.
	threshold: z.number(),
	// The order of each pair's vendor bitmask: the run's vendors, oldest first.
	vendorIds: z.array(z.string()),
	rows: z.array(statsRowSchema),
	sources: z.array(
		z.object({
			suggested: z.boolean(),
			judged: z.boolean(),
			match: z.boolean(),
			mask: z.number().int(),
			count: z.number().int()
		})
	),
	// Per vendor id.
	patterns: z.record(z.string(), fieldPatternsSchema),
	top: z.record(z.string(), z.object({ missed: z.array(z.string()), merges: z.array(z.string()) })),
	models: z.array(z.string()),
	recordCount: z.number().int()
})

export type RunSummary = z.infer<typeof runSummarySchema>

// The Overview for one vendor. `top` is the summary's top disagreements as
// rows (results.ts reads those few pairs).
export function buildOverview({
	summary,
	vendors,
	vendorId,
	top
}: {
	summary: RunSummary
	vendors: Array<{ id: string; name: string }>
	vendorId: string | undefined
	top: { missed: ResultRow[]; merges: ResultRow[] }
}) {
	const { rows, vendorIds } = summary
	const indexOf = (id: string | undefined) => (id == null ? -1 : vendorIds.indexOf(id))
	const selectedIndex = indexOf(vendorId)
	// No vendor: nothing to count for one.
	const selectedRows = selectedIndex === -1 ? [] : rows
	const metrics = statsMetrics(selectedRows, selectedIndex)
	const points = statsSensitivity(selectedRows, selectedIndex)
	const coverage = statsCoverage(rows)

	return {
		metrics,
		// Every vendor's metrics, for the other-vendor ticks and the comparison.
		byVendor: vendors.map((vendor) => ({
			...vendor,
			metrics: vendor.id === vendorId ? metrics : statsMetrics(rows, indexOf(vendor.id))
		})),
		sensitivity: points,
		stableRange: stableRange(points, metrics, summary.threshold),
		top,
		workload: statsWorkload(selectedRows, selectedIndex),
		coverage: {
			total: coverage.total,
			assessed: metrics.assessed,
			pending: metrics.pending,
			failed: metrics.failed,
			suggested: coverage.suggested,
			addedByVendor: coverage.addedByVendor,
			notCompared: Math.max(0, possiblePairs(summary.recordCount) - coverage.total)
		},
		fieldPatterns: (vendorId == null ? undefined : summary.patterns[vendorId]) ?? {
			columns: [],
			rows: [],
			summary: {}
		}
	}
}

export type ResultsOverview = ReturnType<typeof buildOverview>

export type SummaryPair = {
	id: string
	recordAId: string
	recordBId: string
	isSuggested: boolean
	matchedByExportIds: string[]
	assessment: { status: AssessmentStatus; score: number | null; modelReported?: string | null }
}

// A run's summary from its pairs in memory: what run-summary.ts builds in
// the database, pair by pair. The tests' way to make one, and the reference
// the database's is checked against.
export function summarizePairs({
	pairs,
	records,
	vendorIds,
	threshold,
	columnRoles,
	country
}: {
	pairs: SummaryPair[]
	records: ReadonlyMap<string, { values: Record<string, string> }>
	vendorIds: string[]
	threshold: number
	columnRoles: Record<string, FieldRole>
	country: string
}): RunSummary {
	const judged = (pair: SummaryPair) =>
		pair.assessment.status === 'succeeded' && pair.assessment.score != null
	const isMatch = (pair: SummaryPair) => judged(pair) && (pair.assessment.score ?? 0) >= threshold
	const maskOf = (pair: SummaryPair) =>
		vendorIds.reduce(
			(bits, id, index) => (pair.matchedByExportIds.includes(id) ? bits | (1 << index) : bits),
			0
		)
	const rows: StatsRow[] = binPairs({
		pairs: pairs.map((pair) => ({ ...pair, ...pair.assessment })),
		vendorIds,
		threshold
	})

	const sources = new Map<string, SourceStat>()
	for (const pair of pairs) {
		const stat = {
			suggested: pair.isSuggested,
			judged: judged(pair),
			match: isMatch(pair),
			mask: maskOf(pair)
		}
		const key = JSON.stringify(stat)
		const existing = sources.get(key)
		if (existing == null) sources.set(key, { ...stat, count: 1 })
		else existing.count++
	}

	const patterns: RunSummary['patterns'] = {}
	const top: RunSummary['top'] = {}
	const fields = new Map(
		pairs.filter(judged).flatMap((pair) => {
			const valuesA = records.get(pair.recordAId)?.values
			const valuesB = records.get(pair.recordBId)?.values
			return valuesA == null || valuesB == null
				? []
				: [[pair.id, compareFields({ valuesA, valuesB, columnRoles, country }).fields] as const]
		})
	)
	vendorIds.forEach((vendorId, index) => {
		const counts: Partial<Record<Category, number>> = {}
		const tallies: PatternTallies = new Map()
		const missed: SummaryPair[] = []
		const merges: SummaryPair[] = []
		for (const pair of pairs.filter(judged)) {
			const vendor = matchedBy(maskOf(pair), index)
			const category = categoryOf(true, isMatch(pair), vendor)
			if (category === 'incomplete') continue
			counts[category] = (counts[category] ?? 0) + 1
			const compared = fields.get(pair.id)
			if (compared != null) tallyPair(tallies, category, compared)
			if (category === 'pairsight_only') missed.push(pair)
			if (category === 'vendor_only') merges.push(pair)
		}
		patterns[vendorId] = finishFieldPatterns(counts, tallies)
		const score = (pair: SummaryPair) => pair.assessment.score ?? 0
		const byId = (a: SummaryPair, b: SummaryPair) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
		top[vendorId] = {
			missed: missed
				.sort((a, b) => score(b) - score(a) || byId(a, b))
				.slice(0, TOP_DISAGREEMENTS)
				.map((pair) => pair.id),
			merges: merges
				.sort((a, b) => score(a) - score(b) || byId(a, b))
				.slice(0, TOP_DISAGREEMENTS)
				.map((pair) => pair.id)
		}
	})

	return {
		threshold,
		vendorIds,
		rows,
		sources: [...sources.values()],
		patterns,
		top,
		models: [...new Set(pairs.flatMap((pair) => pair.assessment.modelReported ?? []))].sort(),
		recordCount: records.size
	}
}
