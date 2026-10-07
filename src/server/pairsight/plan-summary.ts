import { MIN_JEV_FIELDS } from '@/lib/pairsight/entity-types'
import { LIMITS } from './limits'
import { groupPairCount, pairKey, type ComparisonPair } from './pairs'
import type { SkipReason, SplinkState } from './splink/picks'

// The pure half of the comparison plan: counts, blockers, and — when the plan
// is over the limit — what is making it big. computePlan (plan.ts) loads the
// data; everything here is testable without a database.

export type PlanBlocker =
	| 'no_dataset'
	| 'no_vendors'
	| 'no_jev_fields'
	| 'no_pairs'
	| 'too_many_pairs'
	// PairSight is still working out which pairs to suggest: the run waits
	// for them rather than starting without (splink/picks.ts).
	| 'still_suggesting'
	// It couldn't (it failed, or isn't set up on this server): try again.
	| 'suggestions_failed'
	// The file is too small to learn from (saved before small files were
	// refused): a bigger file is needed.
	| 'too_few_records'

export type PlanCounts = {
	records: number
	// Pairs PairSight suggested.
	suggestedPairs: number
	vendorPairs: number
	// Vendor pairs PairSight didn't suggest, added so every one is checked.
	addedByVendorOnly: number
	uniquePairs: number
	allPossiblePairs: number
	reusable: number
	toEvaluate: number
}

// One source of pairs, largest first: what to say when the plan is over the
// limit. The two never overlap: a vendor pair PairSight also suggested counts
// as suggested.
export type PlanContributor = { kind: 'suggested' | 'vendors'; pairCount: number }

type VendorPair = { a: string; b: string }

export function summarizePlan({
	recordCount,
	comparison,
	vendorPairs,
	reusableKeys,
	vendorCount,
	jevFieldCount,
	suggestions
}: {
	recordCount: number
	comparison: ComparisonPair[]
	vendorPairs: VendorPair[]
	reusableKeys: ReadonlySet<string>
	vendorCount: number
	jevFieldCount: number
	// Where PairSight's suggestions stand (splink/picks.ts).
	suggestions: { state: SplinkState; reason: SkipReason | null }
}): { counts: PlanCounts; blockers: PlanBlocker[]; contributors: PlanContributor[] } {
	const suggestedPairs = comparison.filter((pair) => pair.isSuggested).length
	const addedByVendorOnly = comparison.length - suggestedPairs
	const reusable = comparison.filter((pair) => reusableKeys.has(pairKey(pair))).length
	const counts: PlanCounts = {
		records: recordCount,
		suggestedPairs,
		vendorPairs: new Set(vendorPairs.map(pairKey)).size,
		addedByVendorOnly,
		uniquePairs: comparison.length,
		allPossiblePairs: groupPairCount(recordCount),
		reusable,
		toEvaluate: comparison.length - reusable
	}

	const blockers: PlanBlocker[] = []
	if (vendorCount === 0) blockers.push('no_vendors')
	if (jevFieldCount < MIN_JEV_FIELDS) blockers.push('no_jev_fields')
	switch (suggestions.state) {
		case 'waiting':
			// Starting now would leave the suggestions out.
			blockers.push('still_suggesting')
			break
		case 'skipped':
			blockers.push(
				suggestions.reason === 'too_few_records' ? 'too_few_records' : 'suggestions_failed'
			)
			break
		case 'failed':
			blockers.push('suggestions_failed')
			break
		case 'done':
			if (comparison.length === 0) blockers.push('no_pairs')
	}
	if (comparison.length > LIMITS.maxPairsPerRun) blockers.push('too_many_pairs')

	const contributors: PlanContributor[] = [
		{ kind: 'suggested' as const, pairCount: suggestedPairs },
		{ kind: 'vendors' as const, pairCount: addedByVendorOnly }
	]
		.filter((contributor) => contributor.pairCount > 0)
		.sort((first, second) => second.pairCount - first.pairCount)

	return { counts, blockers, contributors }
}
