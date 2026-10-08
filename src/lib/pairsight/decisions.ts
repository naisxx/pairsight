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
// likely-different pairs scored at most 0.11 and likely-same ones well above
// the default (SCORE_BANDS below: our tests' figures).
export const DEFAULT_THRESHOLD = 0.5

// The thresholds Rules offers by name (docs/PairSight-UX-Plan.md, "What
// shipped"): either side of the default, both still well inside the gap the
// live check found. A custom value may be anything between the bounds.
export const THRESHOLD_PRESETS = {
	lenient: 0.35,
	balanced: DEFAULT_THRESHOLD,
	strict: 0.7
} as const
export type ThresholdPreset = keyof typeof THRESHOLD_PRESETS
export const THRESHOLD_PRESET_NAMES = [
	'lenient',
	'balanced',
	'strict'
] as const satisfies readonly ThresholdPreset[]
// Where Jev's scores fell in our tests on people, organisations and
// products: clearly different records at or below the first, true matches
// at or above the second. The cut-off scale (cutoff-scale.tsx) shades them.
export const SCORE_BANDS = { differentUpTo: 0.11, sameFrom: 0.63 } as const
export const MIN_THRESHOLD = 0.01
export const MAX_THRESHOLD = 0.99

// The preset a threshold is, if it is one.
export function thresholdPreset(threshold: number): ThresholdPreset | null {
	return THRESHOLD_PRESET_NAMES.find((name) => THRESHOLD_PRESETS[name] === threshold) ?? null
}

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
