import { categorize, isLowConfidence, type AssessmentStatus, type Category } from './decisions'

// Agreement metrics for one vendor against PairSight's (Jev's) judgments
// (docs/PairSight-V1-Scope.md). Jev is the reference, so these are
// AI-estimated and cover evaluated pairs only — never "accuracy". Pure, so
// the server computes the Results overview and the browser previews a new
// threshold with the same definitions.
//
//   TP = both matched · FP = vendor only · FN = PairSight only
//   precision = TP / (TP + FP) · recall = TP / (TP + FN) · F1 = their harmonic mean

export type MetricPair = {
	status: AssessmentStatus
	score: number | null
	isVendorMatch: boolean
}

export type ResultCategory = Category | 'incomplete'
export type CategoryCounts = Record<ResultCategory, number>

export type VendorMetrics = {
	counts: CategoryCounts
	total: number
	assessed: number
	pending: number
	failed: number
	tp: number
	fp: number
	fn: number
	precision: number | null
	recall: number | null
	f1: number | null
}

export function emptyCounts(): CategoryCounts {
	return { both_matched: 0, pairsight_only: 0, vendor_only: 0, neither_matched: 0, incomplete: 0 }
}

export function vendorMetrics(pairs: MetricPair[], threshold: number): VendorMetrics {
	const counts = emptyCounts()
	let pending = 0
	let failed = 0
	for (const pair of pairs) {
		counts[categorize({ ...pair, threshold })]++
		if (pair.status === 'failed') failed++
		else if (pair.status !== 'succeeded') pending++
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
		total: pairs.length,
		assessed: pairs.length - counts.incomplete,
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

// ---- Threshold sensitivity ----

const SWEEP_STEPS = 20
// The first and last cut-off the sweep reads (0.05 and 0.95).
export const SWEEP_FROM = 1 / SWEEP_STEPS
export const SWEEP_TO = (SWEEP_STEPS - 1) / SWEEP_STEPS
// How far "lower" and "raise" look from the current threshold.
export const SENSITIVITY_STEP = 0.1

export type SensitivityPoint = {
	threshold: number
	precision: number | null
	recall: number | null
	f1: number | null
	// Pairs PairSight calls a match at this threshold.
	matches: number
}

// The metrics at every 0.05 from 0.05 to 0.95, from saved scores only.
export function sensitivity(pairs: MetricPair[]): SensitivityPoint[] {
	return Array.from({ length: SWEEP_STEPS - 1 }, (_, index) => {
		const threshold = (index + 1) / SWEEP_STEPS
		const metrics = vendorMetrics(pairs, threshold)
		return {
			threshold,
			precision: metrics.precision,
			recall: metrics.recall,
			f1: metrics.f1,
			matches: metrics.tp + metrics.fn
		}
	})
}

// How far the cut-off can move before the picture changes: the unbroken
// stretch of sweep points, around the one nearest the current cut-off, that
// give exactly the same correct merges and duplicates found. Null when there
// is no such stretch, or it's a single point (any change moves the numbers);
// a match further along the sweep, past a point that differs, doesn't count.
export function stableRange(
	points: SensitivityPoint[],
	current: { precision: number | null; recall: number | null },
	threshold: number
): { from: number; to: number } | null {
	const isSame = (point: SensitivityPoint | undefined) =>
		point != null && point.precision === current.precision && point.recall === current.recall
	let anchor = -1
	for (const [index, point] of points.entries()) {
		const best = points[anchor]
		if (
			best == null ||
			Math.abs(point.threshold - threshold) < Math.abs(best.threshold - threshold)
		) {
			anchor = index
		}
	}
	if (!isSame(points[anchor])) return null
	let start = anchor
	let end = anchor
	while (isSame(points[start - 1])) start--
	while (isSame(points[end + 1])) end++
	const from = points[start]
	const to = points[end]
	return from == null || to == null || start === end
		? null
		: { from: from.threshold, to: to.threshold }
}

// ---- Score distribution ----

const HISTOGRAM_BINS = 10

export type HistogramBin = { from: number; to: number; matched: number; notMatched: number }

// Judged scores in 0.1-wide bins, split by the vendor's decision.
export function histogram(pairs: MetricPair[]): HistogramBin[] {
	const bins: HistogramBin[] = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
		from: index / HISTOGRAM_BINS,
		to: (index + 1) / HISTOGRAM_BINS,
		matched: 0,
		notMatched: 0
	}))
	for (const pair of pairs) {
		if (pair.status !== 'succeeded' || pair.score == null) continue
		const bin = bins[Math.min(HISTOGRAM_BINS - 1, Math.floor(pair.score * HISTOGRAM_BINS))]
		if (bin == null) continue
		if (pair.isVendorMatch) bin.matched++
		else bin.notMatched++
	}
	return bins
}

// ---- Review workload ----

export type Workload = {
	disagreements: number
	pairsightOnly: number
	vendorOnly: number
	// Judged pairs inside the low-confidence band, whatever the vendor said.
	nearThreshold: number
	incomplete: number
}

export function workload(pairs: MetricPair[], threshold: number): Workload {
	const { counts } = vendorMetrics(pairs, threshold)
	const nearThreshold = pairs.filter(
		(pair) =>
			pair.status === 'succeeded' &&
			pair.score != null &&
			isLowConfidence({ score: pair.score, threshold })
	).length
	return {
		disagreements: counts.pairsight_only + counts.vendor_only,
		pairsightOnly: counts.pairsight_only,
		vendorOnly: counts.vendor_only,
		nearThreshold,
		incomplete: counts.incomplete
	}
}

// Every unordered pair of n records: n(n−1)/2.
export function possiblePairs(recordCount: number): number {
	return (recordCount * (recordCount - 1)) / 2
}
