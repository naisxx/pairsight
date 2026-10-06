import { SPLINK_RULE_ID } from '@/lib/pairsight/suggested'
import type { BlockingRule, RuleStats } from './blocking'
import { MIN_JEV_FIELDS } from '@/lib/pairsight/custom-rules'
import { LIMITS } from './limits'
import { groupPairCount, pairKey, type ComparisonPair } from './pairs'

// The pure half of the comparison plan: counts, blockers, and — when the plan
// is over the cap — what is making it big. computePlan (plan.ts) loads the
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

export type PlanCounts = {
	records: number
	blockedPairs: number
	vendorPairs: number
	addedByVendorOnly: number
	uniquePairs: number
	allPossiblePairs: number
	reusable: number
	toEvaluate: number
	// Pairs Splink picked, and of those, the ones no rule picked.
	splinkPairs: number
	addedBySplinkOnly: number
	// False when the rules pick more pairs than one run can check and they
	// weren't all built (blocking.ts): the pair counts are then "at least",
	// and the plan is blocked.
	isExact: boolean
}

// One source of pairs, largest first. Rules overlap, so rule contributions
// can add up to more than the unique total; vendor-only pairs never overlap
// a rule by definition.
export type PlanContributor =
	| {
			kind: 'rule'
			ruleId: string
			fields: BlockingRule['fields']
			pairCount: number
			largestBucket: number
	  }
	| { kind: 'vendors'; pairCount: number }
	| { kind: 'splink'; pairCount: number }

type VendorPair = { a: string; b: string }

// The rules a plan uses. When suggestions can't run here (too few records,
// not people, not available) and no rule is on, the type's simple default
// rules pick the pairs instead, so a plan never goes empty by accident.
// Switched off on purpose, it's your rules (or none) as set. While
// suggestions are still being worked out, the run waits for them.
export function rulesForPlan({
	saved,
	suggestions,
	defaults
}: {
	saved: BlockingRule[]
	suggestions: 'off' | 'waiting' | 'done' | 'skipped' | 'failed'
	defaults: BlockingRule[]
}): { rules: BlockingRule[]; isUsingDefaultRules: boolean } {
	const isUsingDefaultRules =
		saved.length === 0 && (suggestions === 'skipped' || suggestions === 'failed')
	return { rules: isUsingDefaultRules ? defaults : saved, isUsingDefaultRules }
}

// Among a pair's reasons for being checked: suggested by PairSight.
export { SPLINK_RULE_ID }

export function summarizePlan({
	recordCount,
	rules,
	ruleStats,
	comparison,
	vendorPairs,
	reusableKeys,
	vendorCount,
	jevFieldCount,
	isComplete = true,
	splinkPairCount = 0
}: {
	recordCount: number
	rules: BlockingRule[]
	ruleStats: RuleStats[]
	// Whether blocking built every pair; when not, `comparison` holds only
	// the vendors' pairs and the rules' total is known to be over the limit.
	isComplete?: boolean
	// Pairs Splink picked; they're among `comparison`, with SPLINK_RULE_ID.
	splinkPairCount?: number
	comparison: ComparisonPair[]
	vendorPairs: VendorPair[]
	reusableKeys: ReadonlySet<string>
	vendorCount: number
	jevFieldCount: number
}): { counts: PlanCounts; blockers: PlanBlocker[]; contributors: PlanContributor[] } {
	const vendorPairCount = new Set(vendorPairs.map(pairKey)).size
	// Not every pair was built: the rules alone pick more than the limit, at
	// least as many as the biggest rule. Nothing is reused or added to that.
	const atLeast = Math.max(LIMITS.maxPairsPerRun + 1, ...ruleStats.map((stat) => stat.pairCount))
	const reusable = isComplete
		? comparison.filter((pair) => reusableKeys.has(pairKey(pair))).length
		: 0
	const addedByVendorOnly = isComplete
		? comparison.filter((pair) => pair.ruleIds.length === 0).length
		: 0
	const uniquePairs = isComplete ? comparison.length : atLeast
	// Picked by a rule or by Splink, counted once.
	const blockedPairCount = comparison.filter((pair) => pair.ruleIds.length > 0).length
	const addedBySplinkOnly = comparison.filter(
		(pair) => pair.ruleIds.length === 1 && pair.ruleIds[0] === SPLINK_RULE_ID
	).length
	const counts: PlanCounts = {
		records: recordCount,
		blockedPairs: isComplete ? blockedPairCount : atLeast,
		vendorPairs: vendorPairCount,
		addedByVendorOnly,
		uniquePairs,
		allPossiblePairs: groupPairCount(recordCount),
		reusable,
		toEvaluate: uniquePairs - reusable,
		splinkPairs: splinkPairCount,
		addedBySplinkOnly,
		isExact: isComplete
	}

	const blockers: PlanBlocker[] = []
	if (vendorCount === 0) blockers.push('no_vendors')
	if (jevFieldCount < MIN_JEV_FIELDS) blockers.push('no_jev_fields')
	if (uniquePairs === 0) blockers.push('no_pairs')
	if (uniquePairs > LIMITS.maxPairsPerRun) blockers.push('too_many_pairs')

	const ruleContributors: PlanContributor[] = rules.flatMap((rule) => {
		const stat = ruleStats.find((candidate) => candidate.ruleId === rule.id)
		return stat == null || stat.pairCount === 0
			? []
			: [
					{
						kind: 'rule' as const,
						ruleId: rule.id,
						fields: rule.fields,
						pairCount: stat.pairCount,
						largestBucket: stat.largestBucket
					}
				]
	})
	const contributors = [
		...ruleContributors,
		...(addedByVendorOnly > 0 ? [{ kind: 'vendors' as const, pairCount: addedByVendorOnly }] : []),
		...(splinkPairCount > 0 ? [{ kind: 'splink' as const, pairCount: splinkPairCount }] : [])
	].sort((first, second) => second.pairCount - first.pairCount)

	return { counts, blockers, contributors }
}
