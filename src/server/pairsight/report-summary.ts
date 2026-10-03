import { isPairsightMatch } from '@/lib/pairsight/decisions'
import {
	sensitivity,
	stableRange,
	vendorMetrics,
	type MetricPair,
	type SensitivityPoint,
	type VendorMetrics
} from '@/lib/pairsight/metrics'
import { compareFields, type FieldComparison } from './compare'
import type { FieldRole, IdentityRole } from './fields'
import { fieldPatterns, topDisagreements } from './result-overview'
import { buildRows, type AssessmentStatus, type RecordSummary } from './result-rows'

// The summary report's content (docs/PairSight-UX-Plan.md, "Summary report"):
// which vendor matched most like Jev on this data, what each gets wrong, the
// pairs that show it, and how far that holds. Pure: numbers, ids and roles
// only; the words are the PDF's (report-pdf/). Jev is the reference, so all
// of it is agreement with an AI, never verified accuracy.

export type ReportPair = {
	id: string
	recordAId: string
	recordBId: string
	ruleIds: string[]
	matchedByExportIds: string[]
	assessment: { status: AssessmentStatus; score: number | null; errorCode: string | null }
}

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
export function headToHead(
	pairs: ReportPair[],
	vendors: Array<{ id: string }>,
	threshold: number
): HeadToHead[] {
	const results: HeadToHead[] = []
	vendors.forEach((a, index) => {
		for (const b of vendors.slice(index + 1)) {
			let sidedWithA = 0
			let total = 0
			for (const { matchedByExportIds: matchedBy, assessment } of pairs) {
				if (assessment.status !== 'succeeded' || assessment.score == null) continue
				const byA = matchedBy.includes(a.id)
				if (byA === matchedBy.includes(b.id)) continue
				total++
				if (byA === isPairsightMatch({ score: assessment.score, threshold })) sidedWithA++
			}
			results.push({ a: a.id, b: b.id, total, sidedWithA, sidedWithB: total - sidedWithA })
		}
	})
	return results
}

export type ReportInput = {
	threshold: number
	country: string
	columnRoles: Record<string, FieldRole>
	records: ReadonlyMap<string, ReportRecord>
	vendors: Array<{ id: string; name: string }>
	pairs: ReportPair[]
}

export function buildReport({
	threshold,
	country,
	columnRoles,
	records,
	vendors,
	pairs
}: ReportInput) {
	const metricPairs = (vendorId: string): MetricPair[] =>
		pairs.map(({ assessment, matchedByExportIds }) => ({
			status: assessment.status,
			score: assessment.score,
			isVendorMatch: matchedByExportIds.includes(vendorId)
		}))
	const example = (row: ReturnType<typeof buildRows>[number]): ReportExample[] => {
		const a = records.get(row.recordA.id)
		const b = records.get(row.recordB.id)
		if (a == null || b == null || row.score == null) return []
		const { fields } = compareFields({ valuesA: a.values, valuesB: b.values, columnRoles, country })
		return [
			{ recordA: row.recordA, recordB: row.recordB, score: row.score, ruleIds: row.ruleIds, fields }
		]
	}

	const details = vendors.map((vendor) => {
		const own = metricPairs(vendor.id)
		const rows = buildRows({ pairs, records, threshold, vendorId: vendor.id })
		const top = topDisagreements(rows)
		const { summary } = fieldPatterns({ rows, records, columnRoles, country })
		return {
			...vendor,
			metrics: vendorMetrics(own, threshold),
			sensitivity: sensitivity(own),
			merges: summary.vendor_only ?? null,
			misses: summary.pairsight_only ?? null,
			examples: { merges: top.merges.flatMap(example), misses: top.missed.flatMap(example) }
		}
	})
	const ranked: VendorDetail[] = rankVendors(details)
	const first = ranked[0]
	return {
		vendors: ranked,
		leaders: leaders(ranked),
		leadRange: leadRange(ranked, threshold),
		// Where the leader's own precision and recall hold still.
		stableRange: first == null ? null : stableRange(first.sensitivity, first.metrics),
		headToHead: headToHead(pairs, vendors, threshold),
		// The run as a whole: the same for every vendor.
		pairs: first?.metrics ?? vendorMetrics([], threshold),
		fromRules: pairs.filter((pair) => pair.ruleIds.length > 0).length
	}
}

export type ReportModel = ReturnType<typeof buildReport>
