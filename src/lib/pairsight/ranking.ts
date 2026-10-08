import type { VendorMetrics } from './metrics'

// How vendors are ranked, everywhere: the Results verdict and its "Best
// overall" pill, the dashboard's latest result, the landing demo and the
// summary PDF. One rule, so no two places can name a different leader:
// the overall score (F1, balancing correct merges and duplicates found)
// first, then correct merges (precision: fewer wrong merges wins). How
// often a vendor agreed with Jev (agreement.ts) is a supporting number only:
// "both say different" is often the biggest group and would flatter a vendor
// that merges little.

type Ranked = { metrics: VendorMetrics }

// Under this gap in overall score (2 points) a lead is too narrow to call a
// win: the verdict says the two are close, though the leader keeps its pill.
export const CLOSE_GAP = 0.02
// A 0–1 score in tenths of a percentage point, as the screens show it.
const TENTHS_OF_A_POINT = 1000
function shown(score: number | null): number {
	return Math.round((score ?? 0) * TENTHS_OF_A_POINT)
}

export function byOverallScore(a: VendorMetrics, b: VendorMetrics): number {
	return (b.f1 ?? -1) - (a.f1 ?? -1) || (b.precision ?? -1) - (a.precision ?? -1)
}

// Best first. A vendor with no overall score (nothing to compare) is listed
// last and not ranked.
export function rankVendors<T extends Ranked>(vendors: T[]): Array<T & { rank: number | null }> {
	const sorted = [...vendors].sort((a, b) => byOverallScore(a.metrics, b.metrics))
	let rank = 0
	return sorted.map((vendor) => ({ ...vendor, rank: vendor.metrics.f1 == null ? null : ++rank }))
}

// The vendor ranked first, when there's a real leader: two or more vendors,
// one with an overall score, and no full tie with the next (same overall
// score and same correct merges).
export function leadingVendorId<T extends Ranked & { id: string }>(vendors: T[]): string | null {
	if (vendors.length < 2) return null
	const [first, second] = rankVendors(vendors)
	if (first == null || first.metrics.f1 == null) return null
	return second != null && byOverallScore(first.metrics, second.metrics) === 0 ? null : first.id
}

// What the verdict says, from the ranking: who leads and by how much, a lead
// too narrow to call, a tie, one vendor on its own, or nothing to say yet.
export type VerdictShape<T> =
	| { kind: 'none' }
	| { kind: 'single'; vendor: T }
	| { kind: 'tie'; first: T; second: T }
	| { kind: 'lead'; lead: T; runnerUp: T }
	| { kind: 'close'; lead: T; runnerUp: T }

export function verdictOf<T extends Ranked & { id: string }>(vendors: T[]): VerdictShape<T> {
	const ranked = rankVendors(vendors)
	const [first, second] = ranked
	if (first == null || first.metrics.f1 == null) return { kind: 'none' }
	if (second == null || second.metrics.f1 == null) return { kind: 'single', vendor: first }
	if (byOverallScore(first.metrics, second.metrics) === 0) {
		return { kind: 'tie', first, second }
	}
	// Judged on the scores as shown (to a tenth of a point), so the words
	// always agree with the numbers beside them.
	const gap = shown(first.metrics.f1) - shown(second.metrics.f1)
	return { kind: gap < shown(CLOSE_GAP) ? 'close' : 'lead', lead: first, runnerUp: second }
}
