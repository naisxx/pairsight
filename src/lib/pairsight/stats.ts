import { isLowConfidence, type AssessmentStatus } from './decisions'
import {
	emptyCounts,
	type HistogramBin,
	type OverlapGroup,
	type SensitivityPoint,
	type VendorMetrics,
	type Workload
} from './metrics'

// Every Overview number from a run's count table: pairs grouped by what
// decides them, a few thousand rows at most whatever the run's size
// (run-summary.ts builds it in the database). Exact, never sampled: each row
// says how many pairs share one combination, and the functions here add
// rows up under the same rules metrics.ts applies pair by pair. Pure and
// client-safe: the threshold preview uses the same table in the browser.

// Scores are kept to 0.01: bin k holds scores from k/100 up to (k+1)/100,
// the same comparison a cut-off of k/100 makes. Bin 100 is a perfect 1.
export const SCORE_BINS = 100

export type RuleKind = 'none' | 'fuzzy' | 'other'

export type StatsRow = {
	status: AssessmentStatus
	// The score's 0.01 bin; null without a score.
	bin: number | null
	// Jev says same at the run's own cut-off, compared exactly (the cut-off
	// may have more decimals than the bins).
	match: boolean
	// A close call at the run's own cut-off, compared exactly.
	near: boolean
	// Bit i set when the run's vendor i matched the pair.
	mask: number
	// Why it was checked: no rule (a vendor's match), only close-match rules,
	// or any other rule.
	kind: RuleKind
	count: number
}

// The bin a score falls in, deciding at each edge exactly as `score >= k/100`
// does, so binned counts agree with pair-by-pair ones at every 0.01 cut-off.
export function scoreBin(score: number): number {
	let bin = Math.floor(score * SCORE_BINS)
	if (score >= (bin + 1) / SCORE_BINS) bin += 1
	if (score < bin / SCORE_BINS) bin -= 1
	return Math.max(0, Math.min(SCORE_BINS, bin))
}

function isJudged(row: StatsRow): row is StatsRow & { bin: number } {
	return row.status === 'succeeded' && row.bin != null
}

const matchedBy = (row: StatsRow, vendorIndex: number) => (row.mask & (1 << vendorIndex)) !== 0

// Jev says same at a cut-off: the run's own (exact) or a 0.01 bin.
type CutOff = { kind: 'run' } | { kind: 'bin'; bin: number }
const RUN: CutOff = { kind: 'run' }
const saysSame = (row: StatsRow & { bin: number }, cutOff: CutOff) =>
	cutOff.kind === 'run' ? row.match : row.bin >= cutOff.bin

function metricsAt(rows: StatsRow[], vendorIndex: number, cutOff: CutOff): VendorMetrics {
	const counts = emptyCounts()
	let total = 0
	let pending = 0
	let failed = 0
	for (const row of rows) {
		total += row.count
		if (row.status === 'failed') failed += row.count
		else if (row.status !== 'succeeded') pending += row.count
		if (!isJudged(row)) {
			counts.incomplete += row.count
			continue
		}
		const vendor = matchedBy(row, vendorIndex)
		const jev = saysSame(row, cutOff)
		const category = vendor
			? jev
				? 'both_matched'
				: 'vendor_only'
			: jev
				? 'pairsight_only'
				: 'neither_matched'
		counts[category] += row.count
	}
	const tp = counts.both_matched
	const fp = counts.vendor_only
	const fn = counts.pairsight_only
	const precision = tp + fp === 0 ? null : tp / (tp + fp)
	const recall = tp + fn === 0 ? null : tp / (tp + fn)
	const f1 =
		precision == null || recall == null
			? null
			: precision + recall === 0
				? 0
				: (2 * precision * recall) / (precision + recall)
	return {
		counts,
		total,
		assessed: total - counts.incomplete,
		pending,
		failed,
		tp,
		fp,
		fn,
		precision,
		recall,
		f1
	}
}

// One vendor at the run's own cut-off.
export function statsMetrics(rows: StatsRow[], vendorIndex: number): VendorMetrics {
	return metricsAt(rows, vendorIndex, RUN)
}

// One vendor at a 0.01 cut-off (the threshold preview's drafts).
export function statsMetricsAt(
	rows: StatsRow[],
	vendorIndex: number,
	threshold: number
): VendorMetrics {
	return metricsAt(rows, vendorIndex, { kind: 'bin', bin: Math.round(threshold * SCORE_BINS) })
}

const SWEEP_STEPS = 20

// The metrics at every 0.05 from 0.05 to 0.95 (metrics.ts `sensitivity`).
export function statsSensitivity(rows: StatsRow[], vendorIndex: number): SensitivityPoint[] {
	return Array.from({ length: SWEEP_STEPS - 1 }, (_, index) => {
		const threshold = (index + 1) / SWEEP_STEPS
		const metrics = statsMetricsAt(rows, vendorIndex, threshold)
		return {
			threshold,
			precision: metrics.precision,
			recall: metrics.recall,
			f1: metrics.f1,
			matches: metrics.tp + metrics.fn
		}
	})
}

const HISTOGRAM_BINS = 10
const BINS_PER_BAR = SCORE_BINS / HISTOGRAM_BINS

// Judged scores in 0.1-wide bars, split by the vendor's decision.
export function statsHistogram(rows: StatsRow[], vendorIndex: number): HistogramBin[] {
	const bars: HistogramBin[] = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
		from: index / HISTOGRAM_BINS,
		to: (index + 1) / HISTOGRAM_BINS,
		matched: 0,
		notMatched: 0
	}))
	for (const row of rows) {
		if (!isJudged(row)) continue
		const bar = bars[Math.min(HISTOGRAM_BINS - 1, Math.floor(row.bin / BINS_PER_BAR))]
		if (bar == null) continue
		if (matchedBy(row, vendorIndex)) bar.matched += row.count
		else bar.notMatched += row.count
	}
	return bars
}

// Judged pairs by which of two vendors matched them (metrics.ts
// `vendorOverlap`).
export function statsOverlap(rows: StatsRow[], first: number, second: number): OverlapGroup[] {
	const groups: OverlapGroup[] = [
		{ key: 'both', total: 0, sameIndividual: 0 },
		{ key: 'firstOnly', total: 0, sameIndividual: 0 },
		{ key: 'secondOnly', total: 0, sameIndividual: 0 },
		{ key: 'neither', total: 0, sameIndividual: 0 }
	]
	for (const row of rows) {
		if (!isJudged(row)) continue
		const a = matchedBy(row, first)
		const b = matchedBy(row, second)
		const group = groups[a && b ? 0 : a ? 1 : b ? 2 : 3]
		if (group == null) continue
		group.total += row.count
		if (row.match) group.sameIndividual += row.count
	}
	return groups
}

export function statsWorkload(rows: StatsRow[], vendorIndex: number): Workload {
	const { counts } = statsMetrics(rows, vendorIndex)
	const nearThreshold = rows
		.filter((row) => isJudged(row) && row.near)
		.reduce((sum, row) => sum + row.count, 0)
	return {
		disagreements: counts.pairsight_only + counts.vendor_only,
		pairsightOnly: counts.pairsight_only,
		vendorOnly: counts.vendor_only,
		nearThreshold,
		incomplete: counts.incomplete
	}
}

// Duplicates found only by close-match rules, and who caught them
// (result-overview.ts `hardCases`).
export function statsHardCases(rows: StatsRow[], vendorIds: readonly string[]) {
	const fuzzy = rows.filter((row) => row.kind === 'fuzzy')
	const confirmed = fuzzy.filter((row) => isJudged(row) && row.match)
	const sum = (list: StatsRow[]) => list.reduce((total, row) => total + row.count, 0)
	return {
		found: sum(fuzzy),
		confirmed: sum(confirmed),
		byVendor: vendorIds.map((id, index) => ({
			id,
			caught: sum(confirmed.filter((row) => matchedBy(row, index)))
		}))
	}
}

// Of the judged pairs only one of two vendors matched, how often Jev sided
// with each (report-summary.ts `headToHead`).
export function statsHeadToHead(rows: StatsRow[], first: number, second: number) {
	let total = 0
	let sidedWithA = 0
	for (const row of rows) {
		if (!isJudged(row)) continue
		const byA = matchedBy(row, first)
		if (byA === matchedBy(row, second)) continue
		total += row.count
		if (byA === row.match) sidedWithA += row.count
	}
	return { total, sidedWithA, sidedWithB: total - sidedWithA }
}

// Pairs found by rules and pairs only a vendor added.
export function statsCoverage(rows: StatsRow[]) {
	let total = 0
	let fromRules = 0
	for (const row of rows) {
		total += row.count
		if (row.kind !== 'none') fromRules += row.count
	}
	return { total, fromRules, addedByVendor: total - fromRules }
}

// Bins pairs the way the database does (run-summary.ts): the reference the
// SQL is checked against, and the tests' way to build a table.
export function binPairs({
	pairs,
	vendorIds,
	threshold,
	fuzzyRuleIds
}: {
	pairs: ReadonlyArray<{
		status: AssessmentStatus
		score: number | null
		matchedByExportIds: readonly string[]
		ruleIds: readonly string[]
	}>
	vendorIds: readonly string[]
	threshold: number
	fuzzyRuleIds: ReadonlySet<string>
}): StatsRow[] {
	const rows = new Map<string, StatsRow>()
	for (const pair of pairs) {
		const bin = pair.score == null ? null : scoreBin(pair.score)
		const judged = pair.status === 'succeeded' && pair.score != null
		const match = judged && pair.score != null && pair.score >= threshold
		const near = judged && pair.score != null && isLowConfidence({ score: pair.score, threshold })
		const mask = vendorIds.reduce(
			(bits, id, index) => (pair.matchedByExportIds.includes(id) ? bits | (1 << index) : bits),
			0
		)
		const kind: RuleKind =
			pair.ruleIds.length === 0
				? 'none'
				: pair.ruleIds.every((ruleId) => fuzzyRuleIds.has(ruleId))
					? 'fuzzy'
					: 'other'
		const key = `${pair.status}|${bin}|${match}|${near}|${mask}|${kind}`
		const row = rows.get(key)
		if (row == null) rows.set(key, { status: pair.status, bin, match, near, mask, kind, count: 1 })
		else row.count += 1
	}
	return [...rows.values()]
}

// One vendor's view of the table, as vendor 0: other vendors and rule kinds
// folded away. What the threshold preview needs, at most a few hundred rows.
export function statsForVendor(rows: StatsRow[], vendorIndex: number): StatsRow[] {
	const folded = new Map<string, StatsRow>()
	for (const row of rows) {
		const mask = matchedBy(row, vendorIndex) ? 1 : 0
		const key = `${row.status}|${row.bin}|${row.match}|${row.near}|${mask}`
		const existing = folded.get(key)
		if (existing == null) folded.set(key, { ...row, mask, kind: 'none' })
		else existing.count += row.count
	}
	return [...folded.values()]
}
