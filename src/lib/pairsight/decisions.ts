// PairSight decisions and agreement categories (docs/PairSight-V1-Scope.md).
// Categories measure agreement between a vendor and PairSight, not
// correctness, and exist only for succeeded evaluations: a pending, running
// or failed pair is "incomplete" — never a nonmatch.

export const CATEGORIES = [
	'both_matched',
	'pairsight_only',
	'vendor_only',
	'neither_matched'
] as const
export type Category = (typeof CATEGORIES)[number]

export type AssessmentStatus = 'pending' | 'running' | 'succeeded' | 'failed'

// Confirmed by the live check (docs/PairSight-V1-Scope.md, "Verified live"):
// likely-different pairs scored ≤ 0.11 and likely-same pairs ≥ 0.76.
export const DEFAULT_THRESHOLD = 0.5

// Width of the "low confidence" band around the threshold, well above Jev's
// observed run-to-run noise (about ±0.01). It raises a filter, never a category.
export const LOW_CONFIDENCE_BAND = 0.1

export function isPairsightMatch({ score, threshold }: { score: number; threshold: number }) {
	return score >= threshold
}

export function categorize({
	isVendorMatch,
	status,
	score,
	threshold
}: {
	isVendorMatch: boolean
	status: AssessmentStatus
	score: number | null
	threshold: number
}): Category | 'incomplete' {
	if (status !== 'succeeded' || score == null) return 'incomplete'
	const isMatch = isPairsightMatch({ score, threshold })
	if (isVendorMatch) return isMatch ? 'both_matched' : 'vendor_only'
	return isMatch ? 'pairsight_only' : 'neither_matched'
}

export function isLowConfidence({ score, threshold }: { score: number; threshold: number }) {
	return Math.abs(score - threshold) < LOW_CONFIDENCE_BAND
}
