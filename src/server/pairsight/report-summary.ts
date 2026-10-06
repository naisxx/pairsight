import { stableRange, type SensitivityPoint, type VendorMetrics } from '@/lib/pairsight/metrics'
import {
	statsCoverage,
	statsHardCases,
	statsHeadToHead,
	statsMetrics,
	statsSensitivity
} from '@/lib/pairsight/stats'
import { compareFields, type FieldComparison } from './compare'
import type { FieldRole, IdentityRole } from './fields'
import type { RunSummary } from './result-overview'
import type { RecordSummary, ResultRow } from './result-rows'

// The summary report's content (docs/PairSight-UX-Plan.md, "Summary report"):
// which vendor matched most like Jev on this data, what each gets wrong, the
// pairs that show it, and how far that holds. Pure: numbers, ids and roles
// only; the words are the PDF's (report-pdf/). Jev is the reference, so all
// of it is agreement with an AI, never verified accuracy.

export type ReportRecord = RecordSummary & { values: Record<string, string> }

export type ReportVendor = { id: string; name: string; metrics: VendorMetrics }

export type HeadToHead = {
	a: string
	b: string
	// Judged pairs exactly one of the two matched, and whose side Jev took.
	total: number
	sidedWithA: number
	sidedWithB: number
}

export type ReportExample = {
	recordA: RecordSummary
	recordB: RecordSummary
	score: number
	ruleIds: string[]
	fields: FieldComparison[]
}

export type VendorDetail = ReportVendor & {
	rank: number | null
	sensitivity: SensitivityPoint[]
	// The fields its disagreements usually share and differ on.
	merges: { shared: IdentityRole[]; different: IdentityRole[] } | null
	misses: { shared: IdentityRole[]; different: IdentityRole[] } | null
	examples: { merges: ReportExample[]; misses: ReportExample[] }
}

// The F1 leader across the thresholds next to the run's: where it stays the
// leader, and who leads just outside that range.
export type LeadRange = {
	leader: string
	from: number
	to: number
	below: { threshold: number; leader: string } | null
	above: { threshold: number; leader: string } | null
}

const byF1ThenPrecision = (a: VendorMetrics, b: VendorMetrics) =>
	(b.f1 ?? -1) - (a.f1 ?? -1) || (b.precision ?? -1) - (a.precision ?? -1)

// Best F1 first, precision breaking ties (fewer wrong merges wins). A vendor
// with no F1 (nothing to compare) is listed last and not ranked.
export function rankVendors<T extends ReportVendor>(
	vendors: T[]
): Array<T & { rank: number | null }> {
	const sorted = [...vendors].sort((a, b) => byF1ThenPrecision(a.metrics, b.metrics))
	let rank = 0
	return sorted.map((vendor) => ({ ...vendor, rank: vendor.metrics.f1 == null ? null : ++rank }))
}

function best(vendors: ReportVendor[], value: (metrics: VendorMetrics) => number | null) {
	let leader: ReportVendor | null = null
	for (const vendor of vendors) {
		const score = value(vendor.metrics)
		if (score == null) continue
		const current = leader == null ? null : value(leader.metrics)
		if (current == null || score > current) leader = vendor
	}
	return leader?.id ?? null
}

// The vendor with the best balance (F1), the safest (precision: fewest wrong
// merges) and the most complete (recall: fewest missed duplicates). Ties go
// to the higher-ranked vendor, so `safest` only differs when it's really ahead.
export function leaders(vendors: ReportVendor[]) {
	const ranked = rankVendors(vendors)
	return {
		best: best(ranked, (metrics) => metrics.f1),
		safest: best(ranked, (metrics) => metrics.precision),
		mostComplete: best(ranked, (metrics) => metrics.recall)
	}
}

function leaderAt(vendors: Array<{ id: string; sensitivity: SensitivityPoint[] }>, index: number) {
	let leader: { id: string; f1: number } | null = null
	for (const vendor of vendors) {
		const f1 = vendor.sensitivity[index]?.f1
		if (f1 == null) continue
		if (leader == null || f1 > leader.f1) leader = { id: vendor.id, f1 }
	}
	return leader?.id ?? null
}

// Needs two or more vendors; null otherwise, or when no one leads at the run's
// threshold.
export function leadRange(
	vendors: Array<{ id: string; sensitivity: SensitivityPoint[] }>,
	threshold: number
): LeadRange | null {
	const points = vendors[0]?.sensitivity ?? []
	if (vendors.length < 2 || points.length === 0) return null
	let start = 0
	points.forEach((point, index) => {
		const nearest = points[start]
		if (
			nearest == null ||
			Math.abs(point.threshold - threshold) < Math.abs(nearest.threshold - threshold)
		) {
			start = index
		}
	})
	const leader = leaderAt(vendors, start)
	if (leader == null) return null
	let from = start
	let to = start
	while (from > 0 && leaderAt(vendors, from - 1) === leader) from--
	while (to < points.length - 1 && leaderAt(vendors, to + 1) === leader) to++
	const outside = (index: number) => {
		const other = leaderAt(vendors, index)
		const point = points[index]
		return other == null || point == null ? null : { threshold: point.threshold, leader: other }
	}
	return {
		leader,
		from: points[from]?.threshold ?? threshold,
		to: points[to]?.threshold ?? threshold,
		below: from > 0 ? outside(from - 1) : null,
		above: to < points.length - 1 ? outside(to + 1) : null
	}
}

// For every two vendors: of the judged pairs only one of them matched, how
// often Jev agreed with each. The fairest one-line comparison there is: it
// only counts the pairs where they actually disagree.
export function headToHead(summary: RunSummary, vendors: Array<{ id: string }>): HeadToHead[] {
	const results: HeadToHead[] = []
	vendors.forEach((a, index) => {
		for (const b of vendors.slice(index + 1)) {
			const counts = statsHeadToHead(
				summary.rows,
				summary.vendorIds.indexOf(a.id),
				summary.vendorIds.indexOf(b.id)
			)
			results.push({ a: a.id, b: b.id, ...counts })
		}
	})
	return results
}

// One of the pairs that show a vendor's disagreements, with its fields
// compared. Null when a record or the score is missing.
export function reportExample({
	row,
	records,
	columnRoles,
	country
}: {
	row: ResultRow
	records: ReadonlyMap<string, { values: Record<string, string> }>
	columnRoles: Record<string, FieldRole>
	country: string
}): ReportExample[] {
	const a = records.get(row.recordA.id)
	const b = records.get(row.recordB.id)
	if (a == null || b == null || row.score == null) return []
	const { fields } = compareFields({ valuesA: a.values, valuesB: b.values, columnRoles, country })
	return [
		{ recordA: row.recordA, recordB: row.recordB, score: row.score, ruleIds: row.ruleIds, fields }
	]
}

export type ReportInput = {
	summary: RunSummary
	vendors: Array<{ id: string; name: string }>
	// Each vendor's top disagreements (the summary's), with their fields.
	examples: Record<string, { merges: ReportExample[]; misses: ReportExample[] }>
}

export function buildReport({ summary, vendors, examples }: ReportInput) {
	const indexOf = (id: string) => summary.vendorIds.indexOf(id)
	const details = vendors.map((vendor) => {
		const index = indexOf(vendor.id)
		const patterns = summary.patterns[vendor.id]?.summary
		return {
			...vendor,
			metrics: statsMetrics(summary.rows, index),
			sensitivity: statsSensitivity(summary.rows, index),
			merges: patterns?.vendor_only ?? null,
			misses: patterns?.pairsight_only ?? null,
			examples: examples[vendor.id] ?? { merges: [], misses: [] }
		}
	})
	const ranked: VendorDetail[] = rankVendors(details)
	const first = ranked[0]
	return {
		vendors: ranked,
		leaders: leaders(ranked),
		leadRange: leadRange(ranked, summary.threshold),
		// Where the leader's own precision and recall hold still.
		stableRange: first == null ? null : stableRange(first.sensitivity, first.metrics),
		headToHead: headToHead(summary, vendors),
		hardCases: statsHardCases(summary.rows, summary.vendorIds),
		// The run as a whole: the same for every vendor.
		pairs: first?.metrics ?? statsMetrics([], -1),
		fromRules: statsCoverage(summary.rows).fromRules
	}
}

export type ReportModel = ReturnType<typeof buildReport>
